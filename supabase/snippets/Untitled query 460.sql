-- ────────────────────────────────────────────────────────────────────────────
-- Seed : user système anonyme (SYSTEM_USER_ID)
-- À exécuter UNE FOIS après la migration RGPD.
-- L'UUID est fixe et doit être copié dans .env → SYSTEM_USER_ID
-- ────────────────────────────────────────────────────────────────────────────

-- UUID fixe pour le user système (ne pas modifier)
DO $$
DECLARE
  system_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Insérer dans auth.users (Supabase Auth) — sans mot de passe, compte non activé
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  )
  VALUES (
    system_user_id,
    'system@supprime.cgp',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insérer dans notre table users
  INSERT INTO public.users (id, email, global_role, is_active, created_at)
  VALUES (
    system_user_id,
    'system@supprime.cgp',
    'cabinet_user',
    false,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'SYSTEM_USER_ID = %', system_user_id;
END $$;
ALTER TABLE consent_records OWNER TO postgres;
ALTER TABLE gdpr_requests OWNER TO postgres;