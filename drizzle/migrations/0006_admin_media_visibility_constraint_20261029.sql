-- Enforce semantic consistency for public and private asset metadata.
alter table public.media_assets
  drop constraint if exists media_assets_check;
alter table public.media_assets
  add constraint media_assets_visibility_bucket_check
  check (
    (bucket_id = 'portfolio-public-assets' and is_public = true)
    or (bucket_id = 'contact-private-attachments' and is_public = false)
  );