-- The products bucket had no size or MIME limit, so a 3MB+ 2000x2000 PNG (or
-- any file type at all) was accepted. The admin UI checked 5MB client-side
-- only, which is trivially bypassed. Enforce it at the storage layer.
UPDATE storage.buckets
   SET file_size_limit = 5242880,  -- 5 MiB, matching the admin UI's own check
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/avif']
 WHERE id = 'products';

UPDATE storage.buckets
   SET file_size_limit = 10485760, -- 10 MiB for customer reference photos
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/avif','image/heic']
 WHERE id = 'custom-order-uploads';
