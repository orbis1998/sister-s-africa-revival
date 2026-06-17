-- Create or promote an admin account directly from the Supabase SQL editor.
-- IMPORTANT:
-- 1. Replace v_email, v_password, v_full_name and v_phone before running.
-- 2. Use a strong temporary password, then change it after first login.
-- 3. This file is not a migration on purpose; run it manually when needed.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_email text := 'admin@example.com';
  v_password text := 'CHANGE_ME_STRONG_PASSWORD';
  v_full_name text := 'Administrateur The Sisters';
  v_phone text := '+243000000000';
  v_user_id uuid;
begin
  if v_email = 'admin@example.com' or v_password = 'CHANGE_ME_STRONG_PASSWORD' then
    raise exception 'Replace v_email and v_password before running this script.';
  end if;

  select id
    into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', v_full_name, 'phone', v_phone),
      false,
      '',
      '',
      '',
      '',
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do update
      set identity_data = excluded.identity_data,
          updated_at = now();
  else
    update auth.users
      set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            || jsonb_build_object('full_name', v_full_name, 'phone', v_phone),
          updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (v_user_id, v_full_name, v_phone)
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        updated_at = now();

  delete from public.user_roles
  where user_id = v_user_id
    and role = 'client';

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  raise notice 'Admin account ready: % / user_id=%', v_email, v_user_id;
end $$;
