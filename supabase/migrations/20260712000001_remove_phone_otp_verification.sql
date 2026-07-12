-- Remove phone OTP verification.
-- The storefront now relies on Supabase email verification only. Phone numbers
-- remain on profiles/orders as delivery contact details, but they are no
-- longer OTP-verified or required before checkout.

DROP TABLE IF EXISTS public.phone_verification_otps;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone_verified_at;
