'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { executeErasure } from '@/lib/erasure/execute';
import { summariseCounts } from '@/lib/erasure/plan';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type DeleteAccountState = { error?: string };

type StripeAction = 'none' | 'cancelled' | 'blocked';

const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const;

export async function deleteAccount(
  _prevState: DeleteAccountState | null,
  formData: FormData,
): Promise<DeleteAccountState> {
  // 1. Validate confirmation
  const confirmation = formData.get('confirmation');
  if (confirmation !== 'DELETE') {
    return { error: 'Type DELETE to confirm.' };
  }

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not signed in.' };
  }
  const userId = user.id;

  const admin = createAdminClient();

  // 3. Idempotency — has this user already been erased?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (admin as any)
    .from('erasure_log')
    .select('id')
    .eq('user_uuid', userId)
    .limit(1);
  if (existing.error) {
    console.error('[erasure] idempotency check failed:', existing.error.message);
    return { error: 'Could not start erasure. Please try again.' };
  }
  if (Array.isArray(existing.data) && existing.data.length > 0) {
    return { error: 'Already erased.' };
  }

  // 4. Capture request metadata
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    null;
  const ua = h.get('user-agent') ?? null;

  // 5. Stripe — cancel any active subscription BEFORE we touch the DB.
  let stripeAction: StripeAction = 'none';
  let stripeSubscriptionId: string | null = null;
  try {
    const { data: subRow, error: subErr } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_uuid', userId)
      .in('status', [...ACTIVE_SUB_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subErr) {
      console.error('[erasure] subscription lookup failed:', subErr.message);
    } else if (subRow?.stripe_subscription_id) {
      stripeSubscriptionId = subRow.stripe_subscription_id;
    }
  } catch (err) {
    console.error('[erasure] subscription lookup threw:', err);
  }

  if (stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(stripeSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
      stripeAction = 'cancelled';
    } catch (err) {
      console.error('[erasure] stripe cancel failed:', err);
      return {
        error: 'Could not cancel your subscription. Please contact support.',
      };
    }
  }

  // 6. Storage — remove patient uploads + report PDFs BEFORE we scrub the
  //    patient_uploads rows (otherwise we lose the storage paths).
  try {
    const { data: uploads } = await admin
      .from('patient_uploads')
      .select('storage_path')
      .eq('user_uuid', userId);

    if (uploads?.length) {
      const paths = uploads
        .map((u: { storage_path: string | null }) => u.storage_path)
        .filter((p): p is string => Boolean(p));
      if (paths.length) {
        const { error: rmErr } = await admin.storage
          .from('patient-uploads')
          .remove(paths);
        if (rmErr) {
          console.error('[erasure] patient-uploads remove failed:', rmErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[erasure] patient-uploads cleanup threw:', err);
  }

  try {
    const reportPrefix = `${userId}/`;
    const { data: reportObjects, error: listErr } = await admin.storage
      .from('report-pdfs')
      .list(userId);
    if (listErr) {
      // Bucket missing or empty — no-op.
      const msg = listErr.message?.toLowerCase() ?? '';
      if (!msg.includes('not found') && !msg.includes('bucket')) {
        console.error('[erasure] report-pdfs list failed:', listErr.message);
      }
    } else if (reportObjects && reportObjects.length > 0) {
      const paths = reportObjects.map((o) => `${reportPrefix}${o.name}`);
      const { error: rmErr } = await admin.storage
        .from('report-pdfs')
        .remove(paths);
      if (rmErr) {
        console.error('[erasure] report-pdfs remove failed:', rmErr.message);
      }
    }
  } catch (err) {
    console.error('[erasure] report-pdfs cleanup threw:', err);
  }

  // 7. Cascade — run the full ERASURE_PLAN.
  const { counts } = await executeErasure(admin, userId);

  // 8. Audit log — single append-only row in public.erasure_log.
  const nowIso = new Date().toISOString();
  // Project default: hard-delete the auth user (full erasure). Set
  // ENABLE_HARD_DELETE=false in env to soft-delete instead (cascade runs,
  // user is signed out, but auth.users row remains). Used in staging /
  // preview environments where re-running tests against the same email
  // matters more than full destruction.
  const hardDelete = process.env.ENABLE_HARD_DELETE !== 'false';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: logErr } = await (admin as any).from('erasure_log').insert({
    user_uuid: userId,
    erased_at: nowIso,
    request_ip: ip,
    request_user_agent: ua,
    confirmation_text: 'DELETE',
    table_counts: summariseCounts(counts),
    hard_delete: hardDelete,
    stripe_subscription_action: stripeAction,
  });
  if (logErr) {
    console.error('[erasure] erasure_log insert failed:', logErr.message);
  }

  // 9. Stamp profiles.erased_at as the soft-delete marker.
  const { error: stampErr } = await admin
    .from('profiles')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ erased_at: nowIso } as any)
    .eq('id', userId);
  if (stampErr) {
    console.error('[erasure] profiles.erased_at stamp failed:', stampErr.message);
  }

  // 10. Finalise — hard delete the auth user (default) or sign out.
  if (hardDelete) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (err) {
      console.error('[erasure] auth.admin.deleteUser failed:', err);
    }
  } else {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[erasure] signOut failed:', err);
    }
  }

  // 11. Redirect to landing with confirmation flag.
  redirect('/?erased=1');
}
