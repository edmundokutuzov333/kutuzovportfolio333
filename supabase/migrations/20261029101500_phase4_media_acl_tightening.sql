-- Phase 4: no direct browser writes to media inventory. Writes use authenticated server functions.
alter table public.media_assets enable row level security;
revoke all on table public.media_assets from public, anon, authenticated;
grant select on table public.media_assets to anon, authenticated;
grant all on table public.media_assets to service_role;

do $bucket_check$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'portfolio-public-assets' and public = true
  ) then
    raise exception 'portfolio_public_assets_bucket_missing_or_not_public';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'contact-private-attachments' and public = false
  ) then
    raise exception 'contact_private_attachments_bucket_missing_or_public';
  end if;
end;
$bucket_check$;
