ALTER TABLE public.wedding_guests
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS attending boolean,
  ADD COLUMN IF NOT EXISTS party_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_wedding_rsvp(guest_name text, guest_phone text, is_attending boolean, guests integer, note text)
RETURNS TABLE(token text, name text, attending boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE k text := 'tel:' || regexp_replace(coalesce(guest_phone,''), '\D', '', 'g');
BEGIN
  IF length(trim(coalesce(guest_name,''))) < 2 OR length(guest_name) > 120 THEN RAISE EXCEPTION 'invalid name'; END IF;
  IF length(k) < 13 OR length(k) > 22 THEN RAISE EXCEPTION 'invalid phone'; END IF;
  IF guests < 1 OR guests > 2 THEN RAISE EXCEPTION 'invalid party'; END IF;
  IF length(coalesce(note,'')) > 500 THEN RAISE EXCEPTION 'invalid note'; END IF;
  RETURN QUERY
  INSERT INTO public.wedding_guests AS g (guest_key, name, phone, attending, party_size, message, responded_at)
  VALUES (k, trim(guest_name), trim(guest_phone), is_attending, guests, nullif(trim(note),''), now())
  ON CONFLICT (guest_key) DO UPDATE SET name = excluded.name, attending = excluded.attending,
    party_size = excluded.party_size, message = excluded.message, responded_at = now()
  RETURNING g.token, g.name, g.attending;
END $$;

REVOKE ALL ON FUNCTION public.submit_wedding_rsvp(text,text,boolean,integer,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_wedding_rsvp(text,text,boolean,integer,text) TO anon, authenticated;