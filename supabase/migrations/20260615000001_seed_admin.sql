-- ============================================================================
-- NEUTRALISED 2026-09-08 — this migration used to commit a known credential.
-- ============================================================================
-- The original body inserted admin@kakeez.com into auth.users with the
-- password literally 'admin' (crypt('admin', gen_salt('bf'))). That account was
-- removed from production long ago, but the statement stayed in the migration
-- history, so rebuilding any environment from scratch -- `supabase db reset`, a
-- new staging project, a local stack -- recreated an administrator whose
-- password is public knowledge in this repository.
--
-- The body is intentionally removed rather than the file, so the migration
-- version stays in sequence for environments that already applied it.
--
-- Admin bootstrapping is handled by 20260617000007_bootstrap_admin.sql, which
-- generates a random password at migration runtime and prints it once to the
-- CLI log instead of committing it.
-- ============================================================================

-- (no-op)
SELECT 1;
