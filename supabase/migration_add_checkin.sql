-- ==============================================================================
-- MIGRAÇÃO: REGISTO DE CHECK-IN E CONTROLO DE USO ÚNICO NA PORTARIA
-- Executa este bloco no SQL Editor do teu painel Supabase
-- ==============================================================================

-- 1. Adicionar a coluna de check-in à tabela wedding_guests
ALTER TABLE public.wedding_guests ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- 2. Atualizar a consulta pública segura do convite para devolver checked_in_at
DROP FUNCTION IF EXISTS public.lookup_wedding_invitation(text);
CREATE OR REPLACE FUNCTION public.lookup_wedding_invitation(invitation_token text)
RETURNS TABLE(
  name text,
  attending boolean,
  party_size integer,
  responded_at timestamptz,
  table_name text,
  checked_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT g.name, g.attending, g.party_size, g.responded_at, g.table_name, g.checked_in_at
  FROM public.wedding_guests g
  WHERE invitation_token ~ '^[a-f0-9]{12,64}$'
    AND g.token = invitation_token
    AND g.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_wedding_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_wedding_invitation(text) TO anon, authenticated, service_role;

-- 3. Função atómica de Check-in para o Porteiro (Garante Uso Único do QR Code)
DROP FUNCTION IF EXISTS public.check_in_wedding_guest(text);
CREATE OR REPLACE FUNCTION public.check_in_wedding_guest(invitation_token text)
RETURNS TABLE(
  success boolean,
  already_checked_in boolean,
  checked_in_at timestamptz,
  guest_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_guest record;
  v_now timestamptz := now();
BEGIN
  IF NOT (invitation_token ~ '^[a-f0-9]{12,64}$') THEN
    RAISE EXCEPTION 'Código de convite inválido.';
  END IF;

  SELECT id, name, checked_in_at, active
  INTO v_guest
  FROM public.wedding_guests
  WHERE token = invitation_token
  LIMIT 1;

  IF NOT FOUND OR v_guest.active = false THEN
    RAISE EXCEPTION 'Convite não encontrado ou desativado.';
  END IF;

  -- Se já deu entrada anteriormente, recusa a entrada duplicada
  IF v_guest.checked_in_at IS NOT NULL THEN
    RETURN QUERY SELECT false, true, v_guest.checked_in_at, v_guest.name;
    RETURN;
  END IF;

  -- Regista a primeira e única entrada oficial
  UPDATE public.wedding_guests
  SET checked_in_at = v_now
  WHERE id = v_guest.id;

  RETURN QUERY SELECT true, false, v_now, v_guest.name;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_wedding_guest(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_wedding_guest(text) TO anon, authenticated, service_role;

-- 4. Atualizar a listagem de convidados dos noivos para incluir checked_in_at
DROP FUNCTION IF EXISTS public.admin_list_guests(text);
CREATE OR REPLACE FUNCTION public.admin_list_guests(p_session text)
RETURNS TABLE(
  id uuid, name text, phone text, token text, party_size integer, attending boolean,
  message text, created_at timestamptz, responded_at timestamptz, active boolean,
  table_name text, checked_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  RETURN QUERY
  SELECT g.id, g.name, g.phone, g.token, g.party_size, g.attending, g.message,
         g.created_at, g.responded_at, g.active, g.table_name, g.checked_in_at
  FROM public.wedding_guests g
  ORDER BY g.created_at DESC;
END $$;

-- 5. Função administrativa para os noivos gerenciarem check-in (marcar ou anular entrada)
DROP FUNCTION IF EXISTS public.admin_toggle_checkin(text, text, boolean);
CREATE OR REPLACE FUNCTION public.admin_toggle_checkin(
  p_session text,
  p_token text,
  p_checked_in boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  UPDATE public.wedding_guests SET
    checked_in_at = CASE WHEN p_checked_in THEN now() ELSE NULL END
  WHERE token = p_token;
END $$;
