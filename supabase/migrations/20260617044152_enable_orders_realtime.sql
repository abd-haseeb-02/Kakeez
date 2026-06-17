-- Phase 4 follow-up: the Phase 0 rebuild dropped/recreated public.orders.
-- The legacy migration had added the old table to supabase_realtime, but the
-- recreated table was not re-added. Admin/customer order subscriptions use
-- postgres_changes on public.orders, so wire the new table back in.

ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
