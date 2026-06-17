
-- Fix search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke direct execute on definer functions (still callable internally via RLS / trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role still needed by authenticated via RLS policies (definer bypasses execute check inside policies? No — keep authenticated execute)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
