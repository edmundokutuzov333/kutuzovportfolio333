-- Phase 2: additive domain fields and a traceable legacy asset inventory.
alter table public.pages add column if not exists route_path text;
create unique index if not exists pages_route_path_uidx on public.pages(route_path) where route_path is not null;

alter table public.profile_content add column if not exists roles text[] not null default '{}';
alter table public.profile_content add column if not exists address text;
alter table public.profile_content add column if not exists phone text;
alter table public.profile_content add column if not exists whatsapp text;
alter table public.profile_content add column if not exists headline text;
alter table public.profile_content add column if not exists intro text;

alter table public.metrics add column if not exists note text;
alter table public.skills add column if not exists value integer check (value is null or value between 0 and 100);
alter table public.skills add column if not exists tier text;
alter table public.disciplines add column if not exists items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array');
alter table public.services add column if not exists number_label text;
alter table public.services add column if not exists line text;
alter table public.process_steps add column if not exists number_label text;
alter table public.projects add column if not exists hue integer not null default 215 check (hue between 0 and 360);
alter table public.projects add column if not exists locale text not null default 'en' check (length(locale) between 2 and 16);

create table if not exists public.asset_migration_inventory (
  manifest_path text primary key,
  asset_id text not null unique,
  source_url text not null,
  source_origin text not null,
  storage_key text,
  original_filename text,
  expected_mime text not null,
  declared_size bigint check (declared_size is null or declared_size >= 0),
  actual_mime text,
  actual_size bigint check (actual_size is null or actual_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  migration_status text not null default 'pending_source_access'
    check (migration_status in ('pending_source_access','source_unreachable','verified','uploaded','blocked')),
  failure_reason text,
  updated_at timestamptz not null default now(),
  check (source_url like '/__l5e/assets-v1/%')
);
alter table public.asset_migration_inventory enable row level security;
drop policy if exists asset_migration_inventory_admin_select on public.asset_migration_inventory;
drop policy if exists asset_migration_inventory_admin_insert on public.asset_migration_inventory;
drop policy if exists asset_migration_inventory_admin_update on public.asset_migration_inventory;
drop policy if exists asset_migration_inventory_admin_delete on public.asset_migration_inventory;
create policy asset_migration_inventory_admin_select on public.asset_migration_inventory for select to authenticated using (public.is_site_admin());
create policy asset_migration_inventory_admin_insert on public.asset_migration_inventory for insert to authenticated with check (public.is_site_admin());
create policy asset_migration_inventory_admin_update on public.asset_migration_inventory for update to authenticated using (public.is_site_admin());
create policy asset_migration_inventory_admin_delete on public.asset_migration_inventory for delete to authenticated using (public.is_site_admin());
revoke all on public.asset_migration_inventory from anon, authenticated;
grant select, insert, update, delete on public.asset_migration_inventory to authenticated;

do $block$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_publication_state'
  ) then
    alter publication supabase_realtime add table public.site_publication_state;
  end if;
end;
$block$;