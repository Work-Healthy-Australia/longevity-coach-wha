-- Sync full_name from auth.users.raw_user_meta_data into profiles on signup.
-- Original handle_new_user() inserted only `id`, so the full_name captured by
-- the signup form (passed via supabase.auth.signUp options.data) never reached
-- the profiles table.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;
