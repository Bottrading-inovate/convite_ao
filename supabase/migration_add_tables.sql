-- ==============================================================================
-- MIGRAÇÃO RÁPIDA: ADICIONAR GESTÃO DE MESAS AO CASAMENTO
-- Executa este bloco no SQL Editor do teu painel Supabase
-- ==============================================================================

-- 1. Adicionar a coluna table_name à tabela wedding_guests
ALTER TABLE public.wedding_guests ADD COLUMN IF NOT EXISTS table_name text;

-- 2. Atualizar a consulta segura do convite para devolver a mesa
DROP FUNCTION IF EXISTS public.lookup_wedding_invitation(text);
CREATE OR REPLACE FUNCTION public.lookup_wedding_invitation(invitation_token text)
RETURNS TABLE(
  name text,
  attending boolean,
  party_size integer,
  responded_at timestamptz,
  table_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT g.name, g.attending, g.party_size, g.responded_at, g.table_name
  FROM public.wedding_guests g
  WHERE invitation_token ~ '^[a-f0-9]{12,64}$'
    AND g.token = invitation_token
    AND g.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_wedding_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_wedding_invitation(text) TO anon, authenticated, service_role;

-- 3. Atualizar a listagem do painel dos noivos para incluir a mesa
DROP FUNCTION IF EXISTS public.admin_list_guests(text);
CREATE OR REPLACE FUNCTION public.admin_list_guests(p_session text)
RETURNS TABLE(
  id uuid, name text, phone text, token text, party_size integer, attending boolean,
  message text, created_at timestamptz, responded_at timestamptz, active boolean,
  table_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  RETURN QUERY
  SELECT g.id, g.name, g.phone, g.token, g.party_size, g.attending, g.message, g.created_at, g.responded_at, g.active, g.table_name
  FROM public.wedding_guests g
  ORDER BY g.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_guests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_guests(text) TO anon, authenticated, service_role;

-- 4. Função para os noivos atribuírem ou alterarem a mesa de um convidado
CREATE OR REPLACE FUNCTION public.admin_set_guest_table(
  p_session text,
  p_token text,
  p_table_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  UPDATE public.wedding_guests SET
    table_name = nullif(trim(coalesce(p_table_name, '')), '')
  WHERE token = p_token;
END $$;

REVOKE ALL ON FUNCTION public.admin_set_guest_table(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_guest_table(text, text, text) TO anon, authenticated, service_role;
