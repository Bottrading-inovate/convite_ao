CREATE TABLE public.wedding_guests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guest_key text NOT NULL UNIQUE CHECK (length(trim(guest_key)) BETWEEN 1 AND 200),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 150),
 token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (token ~ '^[a-f0-9]{64}$')
);
GRANT ALL ON public.wedding_guests TO service_role;
ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.lookup_wedding_invitation(invitation_token text)
RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT g.name FROM public.wedding_guests g WHERE g.token = invitation_token AND g.active = true AND invitation_token ~ '^[a-f0-9]{64}$' LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.lookup_wedding_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_wedding_invitation(text) TO anon, authenticated, service_role;