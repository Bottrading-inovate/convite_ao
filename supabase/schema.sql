-- ==============================================================================
-- JOYFUL UNIQUES — CASAMENTO DE JÚNIOR & HERMENEGILDA (12.12.2026)
-- Script Completo de Inicialização e Estrutura no Supabase (PostgreSQL)
-- ==============================================================================
--
-- INSTRUÇÕES:
-- 1. Acede ao teu painel do Supabase (https://supabase.com/dashboard).
-- 2. Seleciona o teu projeto e clica em "SQL Editor" na barra lateral esquerda.
-- 3. Cola todo o conteúdo deste ficheiro e clica em "Run" (Executar).
-- 4. No fim, o resultado mostra o CÓDIGO DE CONFIGURAÇÃO (uso único).
--    Abre /painel no site, introduz esse código e cria a palavra-passe dos noivos.
--
-- O script pode ser executado novamente sem perder convidados nem a palavra-passe.
-- ==============================================================================

-- 1. Extensões necessárias (UUIDs, bytes aleatórios, bcrypt e SHA-256)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabela principal de Convidados e Convites
CREATE TABLE IF NOT EXISTS public.wedding_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_key text NOT NULL UNIQUE CHECK (length(trim(guest_key)) BETWEEN 1 AND 200),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 150),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  active boolean NOT NULL DEFAULT true,
  phone text,
  attending boolean,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 2),
  message text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (token ~ '^[a-f0-9]{12,64}$')
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_wedding_guests_active ON public.wedding_guests (active);
CREATE INDEX IF NOT EXISTS idx_wedding_guests_created ON public.wedding_guests (created_at DESC);

-- 4. Tabelas de Administração (Área dos Noivos)
-- Credencial única dos noivos: apenas o hash bcrypt é guardado, nunca a palavra-passe.
CREATE TABLE IF NOT EXISTS public.wedding_admin (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Código de configuração de uso único, visível apenas no painel do Supabase.
CREATE TABLE IF NOT EXISTS public.wedding_admin_setup (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  setup_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sessões: apenas o hash SHA-256 do token de sessão é guardado.
CREATE TABLE IF NOT EXISTS public.wedding_admin_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 5. Segurança por Linha (RLS)
-- Sem políticas = nenhum acesso direto pelo público. Tudo passa pelas funções abaixo.
ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_admin_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wedding_guests, public.wedding_admin, public.wedding_admin_setup, public.wedding_admin_sessions FROM anon, authenticated;
GRANT ALL ON public.wedding_guests, public.wedding_admin, public.wedding_admin_setup, public.wedding_admin_sessions TO service_role;

-- Gera o código de configuração apenas se os noivos ainda não criaram a palavra-passe.
INSERT INTO public.wedding_admin_setup (id, setup_code)
SELECT 1, upper(encode(gen_random_bytes(5), 'hex'))
WHERE NOT EXISTS (SELECT 1 FROM public.wedding_admin)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- FUNÇÕES PÚBLICAS (CONVIDADOS)
-- ==============================================================================

-- 6. Consulta segura do convite: devolve o nome e estado de confirmação do convidado ativo.
DROP FUNCTION IF EXISTS public.lookup_wedding_invitation(text);
CREATE OR REPLACE FUNCTION public.lookup_wedding_invitation(invitation_token text)
RETURNS TABLE(
  name text,
  attending boolean,
  party_size integer,
  responded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT g.name, g.attending, g.party_size, g.responded_at
  FROM public.wedding_guests g
  WHERE invitation_token ~ '^[a-f0-9]{12,64}$'
    AND g.token = invitation_token
    AND g.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_wedding_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_wedding_invitation(text) TO anon, authenticated, service_role;

-- 7. Confirmação a partir do link geral (convidado sem convite pessoal).
-- Se o telemóvel já pertencer a um convite emitido pelos noivos, a resposta liga-se a esse convite.
CREATE OR REPLACE FUNCTION public.submit_wedding_rsvp(
  guest_name text,
  guest_phone text,
  is_attending boolean,
  guests integer,
  note text
)
RETURNS TABLE(token text, name text, attending boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  k text := 'tel:' || regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g');
  normalized_name text := trim(coalesce(guest_name, ''));
  normalized_note text := nullif(trim(coalesce(note, '')), '');
BEGIN
  IF length(normalized_name) < 2 OR length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido. Introduz entre 2 e 120 caracteres.';
  END IF;
  IF length(k) < 13 OR length(k) > 22 THEN
    RAISE EXCEPTION 'Número de telemóvel inválido.';
  END IF;
  IF guests < 1 OR guests > 2 THEN
    RAISE EXCEPTION 'O convite permite 1 ou 2 pessoas adultas.';
  END IF;
  IF length(coalesce(note, '')) > 500 THEN
    RAISE EXCEPTION 'Mensagem demasiado extensa (limite de 500 caracteres).';
  END IF;

  RETURN QUERY
  INSERT INTO public.wedding_guests AS g (guest_key, name, phone, attending, party_size, message, responded_at)
  VALUES (k, normalized_name, trim(guest_phone), is_attending, guests, normalized_note, now())
  ON CONFLICT (guest_key) DO UPDATE SET
    attending = excluded.attending,
    party_size = excluded.party_size,
    message = excluded.message,
    responded_at = now()
  WHERE g.active = true
  RETURNING g.token, g.name, g.attending;
END $$;

REVOKE ALL ON FUNCTION public.submit_wedding_rsvp(text, text, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_wedding_rsvp(text, text, boolean, integer, text) TO anon, authenticated, service_role;

-- 8. Confirmação a partir do convite pessoal (link com token).
CREATE OR REPLACE FUNCTION public.confirm_wedding_invitation(
  invitation_token text,
  is_attending boolean,
  guests integer,
  note text
)
RETURNS TABLE(name text, attending boolean, party_size integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF invitation_token !~ '^[a-f0-9]{12,64}$' THEN
    RAISE EXCEPTION 'Convite inválido.';
  END IF;
  IF guests < 1 OR guests > 2 THEN
    RAISE EXCEPTION 'O convite permite 1 ou 2 pessoas adultas.';
  END IF;
  IF length(coalesce(note, '')) > 500 THEN
    RAISE EXCEPTION 'Mensagem demasiado extensa (limite de 500 caracteres).';
  END IF;

  RETURN QUERY
  UPDATE public.wedding_guests g SET
    attending = is_attending,
    party_size = CASE WHEN is_attending THEN guests ELSE g.party_size END,
    message = nullif(trim(coalesce(note, '')), ''),
    responded_at = now()
  WHERE g.token = invitation_token AND g.active = true
  RETURNING g.name, g.attending, g.party_size;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou desativado.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.confirm_wedding_invitation(text, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_wedding_invitation(text, boolean, integer, text) TO anon, authenticated, service_role;

-- ==============================================================================
-- FUNÇÕES DA ÁREA DOS NOIVOS (AUTENTICAÇÃO E GESTÃO)
-- ==============================================================================

-- 9. Validação interna de sessão (não exposta ao público).
CREATE OR REPLACE FUNCTION public.wedding_admin_require_session(p_session text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  DELETE FROM public.wedding_admin_sessions WHERE expires_at < now();
  IF p_session IS NULL OR p_session !~ '^[a-f0-9]{64}$' OR NOT EXISTS (
    SELECT 1 FROM public.wedding_admin_sessions
    WHERE token_hash = encode(digest(p_session, 'sha256'), 'hex') AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Sessão expirada. Entra novamente na Área dos Noivos.' USING ERRCODE = '28000';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.wedding_admin_require_session(text) FROM PUBLIC, anon, authenticated;

-- 10. Estado da área: os noivos já criaram a palavra-passe?
CREATE OR REPLACE FUNCTION public.admin_status()
RETURNS TABLE(configured boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.wedding_admin);
$$;

-- 11. Criação da palavra-passe pelos noivos (exige o código de configuração de uso único).
CREATE OR REPLACE FUNCTION public.admin_setup_password(p_setup_code text, p_password text)
RETURNS TABLE(session_token text, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_code text;
  v_token text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.wedding_admin) THEN
    RETURN QUERY SELECT NULL::text, 'A palavra-passe dos noivos já foi criada.'::text; RETURN;
  END IF;

  SELECT setup_code INTO v_code FROM public.wedding_admin_setup WHERE id = 1;
  IF v_code IS NULL OR upper(trim(coalesce(p_setup_code, ''))) <> v_code THEN
    RETURN QUERY SELECT NULL::text, 'Código de configuração incorreto.'::text; RETURN;
  END IF;

  IF length(coalesce(p_password, '')) < 10 OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RETURN QUERY SELECT NULL::text, 'A palavra-passe precisa de pelo menos 10 caracteres, com letras e números.'::text; RETURN;
  END IF;

  INSERT INTO public.wedding_admin (id, password_hash) VALUES (1, crypt(p_password, gen_salt('bf', 12)));
  DELETE FROM public.wedding_admin_setup WHERE id = 1;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.wedding_admin_sessions (token_hash, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), now() + interval '12 hours');

  RETURN QUERY SELECT v_token, NULL::text;
END $$;

-- 12. Entrada na área dos noivos (bloqueio de 15 minutos após 5 tentativas falhadas).
CREATE OR REPLACE FUNCTION public.admin_login(p_password text)
RETURNS TABLE(session_token text, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_admin public.wedding_admin%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_admin FROM public.wedding_admin WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, 'A palavra-passe ainda não foi criada.'::text; RETURN;
  END IF;

  IF v_admin.locked_until IS NOT NULL AND v_admin.locked_until > now() THEN
    RETURN QUERY SELECT NULL::text,
      format('Demasiadas tentativas. Tenta novamente dentro de %s minuto(s).',
        ceil(extract(epoch FROM (v_admin.locked_until - now())) / 60)::int)::text;
    RETURN;
  END IF;

  IF v_admin.password_hash <> crypt(coalesce(p_password, ''), v_admin.password_hash) THEN
    UPDATE public.wedding_admin SET
      failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
      locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
    WHERE id = 1;
    RETURN QUERY SELECT NULL::text, 'Palavra-passe incorreta.'::text; RETURN;
  END IF;

  UPDATE public.wedding_admin SET failed_attempts = 0, locked_until = NULL WHERE id = 1;
  DELETE FROM public.wedding_admin_sessions WHERE expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.wedding_admin_sessions (token_hash, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), now() + interval '12 hours');

  RETURN QUERY SELECT v_token, NULL::text;
END $$;

-- 13. Terminar sessão.
CREATE OR REPLACE FUNCTION public.admin_logout(p_session text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  DELETE FROM public.wedding_admin_sessions WHERE token_hash = encode(digest(coalesce(p_session, ''), 'sha256'), 'hex');
$$;

-- 14. Alterar a palavra-passe (termina todas as outras sessões).
CREATE OR REPLACE FUNCTION public.admin_change_password(p_session text, p_current text, p_new text)
RETURNS TABLE(error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash text;
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  SELECT password_hash INTO v_hash FROM public.wedding_admin WHERE id = 1;
  IF v_hash <> crypt(coalesce(p_current, ''), v_hash) THEN
    RETURN QUERY SELECT 'A palavra-passe atual está incorreta.'::text; RETURN;
  END IF;
  IF length(coalesce(p_new, '')) < 10 OR p_new !~ '[A-Za-z]' OR p_new !~ '[0-9]' THEN
    RETURN QUERY SELECT 'A nova palavra-passe precisa de pelo menos 10 caracteres, com letras e números.'::text; RETURN;
  END IF;
  UPDATE public.wedding_admin SET password_hash = crypt(p_new, gen_salt('bf', 12)), updated_at = now() WHERE id = 1;
  DELETE FROM public.wedding_admin_sessions WHERE token_hash <> encode(digest(p_session, 'sha256'), 'hex');
  RETURN QUERY SELECT NULL::text;
END $$;

-- 15. Lista completa de convidados (apenas com sessão válida).
CREATE OR REPLACE FUNCTION public.admin_list_guests(p_session text)
RETURNS TABLE(
  id uuid, name text, phone text, token text, party_size integer, attending boolean,
  message text, created_at timestamptz, responded_at timestamptz, active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  RETURN QUERY
  SELECT g.id, g.name, g.phone, g.token, g.party_size, g.attending, g.message, g.created_at, g.responded_at, g.active
  FROM public.wedding_guests g
  ORDER BY g.created_at DESC;
END $$;

-- 16. Emissão de convite (o telemóvel evita convites duplicados para a mesma pessoa).
CREATE OR REPLACE FUNCTION public.admin_create_guest(p_session text, p_name text, p_phone text, p_party_size integer)
RETURNS TABLE(name text, token text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_name text := trim(coalesce(p_name, ''));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key text;
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido: "%".', v_name;
  END IF;
  IF p_party_size NOT IN (1, 2) THEN
    RAISE EXCEPTION 'O convite permite 1 ou 2 pessoas.';
  END IF;
  v_key := CASE WHEN length(v_digits) >= 9 THEN 'tel:' || v_digits ELSE 'guest:' || encode(gen_random_bytes(16), 'hex') END;

  RETURN QUERY
  INSERT INTO public.wedding_guests AS g (guest_key, name, phone, party_size, active)
  VALUES (v_key, v_name, nullif(trim(coalesce(p_phone, '')), ''), p_party_size, true)
  ON CONFLICT (guest_key) DO UPDATE SET name = excluded.name, party_size = excluded.party_size, active = true
  RETURNING g.name, g.token, g.phone;
END $$;

-- 17. Atualização manual de um convidado.
CREATE OR REPLACE FUNCTION public.admin_update_guest(
  p_session text, p_token text, p_name text, p_phone text, p_party_size integer, p_attending boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  UPDATE public.wedding_guests SET
    name = trim(p_name),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    party_size = p_party_size,
    attending = p_attending,
    responded_at = CASE WHEN p_attending IS NULL THEN NULL ELSE now() END
  WHERE token = p_token;
END $$;

-- 18. Remoção de um convidado.
CREATE OR REPLACE FUNCTION public.admin_delete_guest(p_session text, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.wedding_admin_require_session(p_session);
  DELETE FROM public.wedding_guests WHERE token = p_token;
END $$;

-- Permissões das funções dos noivos: a proteção está na sessão validada em cada função.
REVOKE ALL ON FUNCTION public.admin_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_setup_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_logout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_change_password(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_guests(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_guest(text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_guest(text, text, text, text, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_guest(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.admin_status(),
  public.admin_setup_password(text, text),
  public.admin_login(text),
  public.admin_logout(text),
  public.admin_change_password(text, text, text),
  public.admin_list_guests(text),
  public.admin_create_guest(text, text, text, integer),
  public.admin_update_guest(text, text, text, text, integer, boolean),
  public.admin_delete_guest(text, text)
TO anon, authenticated, service_role;

-- Remove a função antiga sem autenticação (substituída por admin_create_guest).
DROP FUNCTION IF EXISTS public.create_guest_invitation(text, text, integer);

-- ==============================================================================
-- RESULTADO: CÓDIGO DE CONFIGURAÇÃO DOS NOIVOS
-- ==============================================================================
-- Se aparecer um código, abre /painel e usa-o para criar a palavra-passe.
-- Se aparecer "configurado", a palavra-passe já existe.
-- Esqueceram-se da palavra-passe? Executem:
--   DELETE FROM public.wedding_admin; DELETE FROM public.wedding_admin_sessions;
-- e voltem a executar este script para gerar um novo código.
SELECT coalesce(
  (SELECT 'Código de configuração: ' || setup_code FROM public.wedding_admin_setup WHERE id = 1),
  'Área dos noivos já configurada.'
) AS resultado;
