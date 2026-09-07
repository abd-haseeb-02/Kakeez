-- ============================================================================
-- Newsletter subscribers
-- ============================================================================
-- The footer's "Stay in the Loop" box was a styled <div> with no input and no
-- handler -- it looked interactive and did nothing. This backs it with a real
-- table. Visitors may INSERT only: they cannot read the list back, so the
-- subscriber list is not harvestable with the public anon key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_email_shape CHECK (
    char_length(email) BETWEEN 5 AND 254 AND email LIKE '%_@_%._%'
  ),
  CONSTRAINT newsletter_source_len CHECK (source IS NULL OR char_length(source) <= 40)
);

-- Case-insensitive uniqueness so the same inbox cannot pile up rows.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key
  ON public.newsletter_subscribers (lower(email));

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Insert-only for the public; no SELECT policy, so nobody can read the list
-- back through the API.
DROP POLICY IF EXISTS newsletter_insert_public ON public.newsletter_subscribers;
CREATE POLICY newsletter_insert_public ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS newsletter_select_staff ON public.newsletter_subscribers;
CREATE POLICY newsletter_select_staff ON public.newsletter_subscribers
  FOR SELECT TO authenticated USING (public.is_staff());

REVOKE UPDATE, DELETE ON public.newsletter_subscribers FROM anon, authenticated;
GRANT INSERT, SELECT ON public.newsletter_subscribers TO anon, authenticated;
