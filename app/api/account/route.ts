import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;
  const now = new Date().toISOString();

  // 1. Write erasure audit record to consent_records (append-only)
  //    Uses direct insert because 'erasure_request' is not a PolicyId enum value.
  await admin.from('consent_records').insert({
    user_uuid: userId,
    policy_id: 'erasure_request',
    policy_version: 'v1',
    accepted_at: now,
  });

  // 2. Scrub PII in profiles
  await admin
    .from('profiles')
    .update({
      full_name: '[ERASED]',
      date_of_birth: null,
      phone: null,
      address_postal: null,
    })
    .eq('id', userId);

  // 3. Delete patient uploads from storage
  const { data: uploads } = await admin
    .from('patient_uploads')
    .select('storage_path')
    .eq('user_uuid', userId);

  if (uploads?.length) {
    const paths = uploads
      .map((u: { storage_path: string | null }) => u.storage_path)
      .filter(Boolean) as string[];
    if (paths.length) {
      await admin.storage.from('patient-uploads').remove(paths);
    }
  }

  // 4. Hard delete auth user (gated by env var — off by default)
  if (process.env.ENABLE_HARD_DELETE === 'true') {
    await admin.auth.admin.deleteUser(userId);
  }

  return NextResponse.json({ ok: true });
}
