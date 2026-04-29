'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not signed in' };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Write erasure audit record directly — 'erasure_request' is not a PolicyId
  await admin.from('consent_records').insert({
    user_uuid: user.id,
    policy_id: 'erasure_request',
    policy_version: 'v1',
    accepted_at: now,
  });

  // Scrub PII
  await admin
    .from('profiles')
    .update({
      full_name: '[ERASED]',
      date_of_birth: null,
      phone: null,
      address_postal: null,
    })
    .eq('id', user.id);

  // Delete uploads from storage
  const { data: uploads } = await admin
    .from('patient_uploads')
    .select('storage_path')
    .eq('user_uuid', user.id);

  if (uploads?.length) {
    const paths = uploads
      .map((u: { storage_path: string | null }) => u.storage_path)
      .filter(Boolean) as string[];
    if (paths.length) {
      await admin.storage.from('patient-uploads').remove(paths);
    }
  }

  // Hard delete auth user (gated by env var — off by default)
  if (process.env.ENABLE_HARD_DELETE === 'true') {
    await admin.auth.admin.deleteUser(user.id);
  }

  redirect('/');
}
