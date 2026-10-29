-- Portfolio-Kutuzov CMS foundation.
-- Applied on the new, empty dedicated Supabase project on 2026-10-29.
create extension if not exists pgcrypto;

create or replace function public.is_site_admin()
returns boolean language sql stable security invoker set search_path = ''
as $function$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'site_role') = 'admin', false);
$function$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to anon, authenticated;

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique check (length(setting_key) between 1 and 120),
  setting_value jsonb not null default '{}'::jsonb check (jsonb_typeof(setting_value) in ('object','array','string','number','boolean','null')),
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+([-/][a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 240),
  locale text not null default 'en' check (length(locale) between 2 and 16),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  seo_title text check (seo_title is null or length(seo_title) <= 300),
  seo_description text check (seo_description is null or length(seo_description) <= 1000),
  canonical_url text, og_image_path text, published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete restrict,
  section_key text not null check (section_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  section_type text not null check (section_type in ('hero','manifesto','featured_work','services','metrics','clients','principles','experience','skills','process','contact_cta','rich_text')),
  position integer not null default 0 check (position >= 0), is_visible boolean not null default true,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(page_id, section_key), unique(page_id, position)
);
create table public.profile_content (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null default 'primary' unique check (singleton_key = 'primary'),
  name text not null default 'Edmundo Kutuzov', role text, biography text, location text,
  portrait_path text, public_email text,
  socials jsonb not null default '[]'::jsonb check (jsonb_typeof(socials) = 'array'),
  is_published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.metrics (
  id uuid primary key default gen_random_uuid(), label text not null check (length(label) between 1 and 140),
  value text not null check (length(value) between 1 and 80), position integer not null default 0 check (position >= 0),
  is_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(position)
);
create table public.experience_items (
  id uuid primary key default gen_random_uuid(), organisation text not null, role text not null,
  period text, description text, position integer not null default 0 check (position >= 0),
  is_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(position)
);
create table public.skills (
  id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 1 and 140),
  level text, category text, position integer not null default 0 check (position >= 0),
  is_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(position)
);
create table public.disciplines (
  id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 1 and 140),
  description text, position integer not null default 0 check (position >= 0),
  is_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(position)
);
create table public.principles (
  id uuid primary key default gen_random_uuid(), title text not null check (length(title) between 1 and 180),
  description text, position integer not null default 0 check (position >= 0),
  is_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(position)
);
create table public.services (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+([-/][a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 180), description text not null default '',
  details jsonb not null default '[]'::jsonb check (jsonb_typeof(details) = 'array'),
  position integer not null default 0 check (position >= 0), is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(position)
);
create table public.process_steps (
  id uuid primary key default gen_random_uuid(), step_key text not null unique check (length(step_key) between 1 and 80),
  title text not null check (length(title) between 1 and 180), description text not null default '',
  position integer not null default 0 check (position >= 0), is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(position)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+([-/][a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 180), logo_path text, logo_alt text,
  display_as_text boolean not null default false, position integer not null default 0 check (position >= 0),
  show_on_home boolean not null default true, show_on_clients_page boolean not null default true, is_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(position)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+([-/][a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 240), client_id uuid references public.clients(id) on delete restrict,
  client_label text, year_label text, discipline text, project_type text, summary text, challenge text, idea text, outcome text,
  cover_path text, cover_alt text, gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  featured boolean not null default false, position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft','published','archived')), published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index projects_public_order_idx on public.projects(status, position, published_at desc);
create table public.slug_redirects (
  id uuid primary key default gen_random_uuid(), old_slug text not null unique, new_slug text not null,
  is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), check (old_slug <> new_slug)
);
create table public.site_publication_state (
  singleton_key text primary key default 'primary' check (singleton_key = 'primary'),
  published_revision bigint not null default 0 check (published_revision >= 0),
  published_at timestamptz not null default now(), published_by uuid references auth.users(id) on delete set null
);
insert into public.site_publication_state(singleton_key, published_revision) values ('primary', 0);
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null check (bucket_id in ('portfolio-public-assets','contact-private-attachments')),
  object_path text not null, original_name text, content_type text not null, byte_size bigint not null check (byte_size >= 0),
  width integer check (width is null or width > 0), height integer check (height is null or height > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'), alt_text text, caption text,
  is_public boolean not null default true, uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), unique(bucket_id, object_path),
  check ((bucket_id = 'portfolio-public-assets' and is_public) or bucket_id = 'contact-private-attachments')
);
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 180),
  email text not null check (length(email) between 3 and 320), company text, request_type text not null, budget text,
  message text not null check (length(message) between 10 and 4000),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  attachment_paths jsonb not null default '[]'::jsonb check (jsonb_typeof(attachment_paths) = 'array'),
  status text not null default 'new' check (status in ('new','in_review','replied','archived')),
  internal_notes text, source_ip_hash text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_submissions_status_created_idx on public.contact_submissions(status, created_at desc);
create index contact_submissions_email_idx on public.contact_submissions(lower(email));
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique check (email = lower(trim(email))),
  status text not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
  consent_text_version text not null, requested_at timestamptz not null default now(),
  confirmed_at timestamptz, unsubscribed_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index newsletter_subscribers_status_created_idx on public.newsletter_subscribers(status, created_at desc);
create table public.newsletter_tokens (
  id uuid primary key default gen_random_uuid(), subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  purpose text not null check (purpose in ('confirm','unsubscribe')), expires_at timestamptz not null,
  used_at timestamptz, created_at timestamptz not null default now()
);
create table public.content_revisions (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null,
  action text not null check (action in ('create','update','publish','archive','restore','reorder')),
  before_snapshot jsonb, after_snapshot jsonb not null, note text, publish_revision bigint,
  actor_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index content_revisions_entity_created_idx on public.content_revisions(entity_type, entity_id, created_at desc);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
  event_type text not null, success boolean not null default true, subject text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index admin_audit_created_idx on public.admin_audit_log(created_at desc);
create table public.admin_auth_attempts (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'), attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(), last_attempt_at timestamptz not null default now(), blocked_until timestamptz
);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(), message_type text not null, recipient text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0), next_attempt_at timestamptz not null default now(),
  last_error text, sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox(status, next_attempt_at);

do $block$ declare table_name text; begin
  foreach table_name in array array[
    'site_settings','pages','page_sections','profile_content','metrics','experience_items','skills','disciplines',
    'principles','services','process_steps','clients','projects','slug_redirects','site_publication_state','media_assets',
    'contact_submissions','newsletter_subscribers','newsletter_tokens','content_revisions','admin_audit_log',
    'admin_auth_attempts','email_outbox'
  ] loop execute format('alter table public.%I enable row level security', table_name); end loop;
end; $block$;

create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (is_public or public.is_site_admin());
create policy pages_public_read on public.pages for select to anon, authenticated using (status = 'published' or public.is_site_admin());
create policy page_sections_public_read on public.page_sections for select to anon, authenticated using (
  public.is_site_admin() or (is_visible and exists (select 1 from public.pages p where p.id = page_id and p.status = 'published'))
);
create policy profile_public_read on public.profile_content for select to anon, authenticated using (is_published or public.is_site_admin());
create policy metrics_public_read on public.metrics for select to anon, authenticated using (is_published or public.is_site_admin());
create policy experience_public_read on public.experience_items for select to anon, authenticated using (is_published or public.is_site_admin());
create policy skills_public_read on public.skills for select to anon, authenticated using (is_published or public.is_site_admin());
create policy disciplines_public_read on public.disciplines for select to anon, authenticated using (is_published or public.is_site_admin());
create policy principles_public_read on public.principles for select to anon, authenticated using (is_published or public.is_site_admin());
create policy services_public_read on public.services for select to anon, authenticated using (is_published or public.is_site_admin());
create policy process_steps_public_read on public.process_steps for select to anon, authenticated using (is_published or public.is_site_admin());
create policy clients_public_read on public.clients for select to anon, authenticated using (is_visible or public.is_site_admin());
create policy projects_public_read on public.projects for select to anon, authenticated using (status = 'published' or public.is_site_admin());
create policy slug_redirects_public_read on public.slug_redirects for select to anon, authenticated using (is_active or public.is_site_admin());
create policy publication_state_public_read on public.site_publication_state for select to anon, authenticated using (true);
create policy media_assets_public_read on public.media_assets for select to anon, authenticated using ((bucket_id = 'portfolio-public-assets' and is_public) or public.is_site_admin());

do $block$ declare table_name text; begin
  foreach table_name in array array[
    'site_settings','pages','page_sections','profile_content','metrics','experience_items','skills','disciplines',
    'principles','services','process_steps','clients','projects','slug_redirects','site_publication_state','media_assets',
    'contact_submissions','newsletter_subscribers','newsletter_tokens','content_revisions','admin_audit_log',
    'admin_auth_attempts','email_outbox'
  ] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())',
      table_name || '_admin_all', table_name);
  end loop;
end; $block$;

grant select on public.site_settings, public.pages, public.page_sections, public.profile_content, public.metrics,
  public.experience_items, public.skills, public.disciplines, public.principles, public.services, public.process_steps,
  public.clients, public.projects, public.slug_redirects, public.site_publication_state, public.media_assets to anon, authenticated;
grant select, insert, update, delete on public.site_settings, public.pages, public.page_sections, public.profile_content,
  public.metrics, public.experience_items, public.skills, public.disciplines, public.principles, public.services,
  public.process_steps, public.clients, public.projects, public.slug_redirects, public.site_publication_state,
  public.media_assets, public.contact_submissions, public.newsletter_subscribers, public.newsletter_tokens,
  public.content_revisions, public.admin_audit_log, public.email_outbox to authenticated;
revoke all on public.admin_auth_attempts from anon, authenticated;
grant all on public.admin_auth_attempts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolio-public-assets','portfolio-public-assets',true,15728640,array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
  ('contact-private-attachments','contact-private-attachments',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set name=excluded.name, public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy portfolio_public_asset_read on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio-public-assets');
create policy portfolio_public_asset_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-public-assets' and public.is_site_admin());
create policy portfolio_public_asset_admin_update on storage.objects for update to authenticated using (bucket_id = 'portfolio-public-assets' and public.is_site_admin()) with check (bucket_id = 'portfolio-public-assets' and public.is_site_admin());
create policy portfolio_public_asset_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'portfolio-public-assets' and public.is_site_admin());
create policy contact_private_attachment_admin_read on storage.objects for select to authenticated using (bucket_id = 'contact-private-attachments' and public.is_site_admin());
create policy contact_private_attachment_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'contact-private-attachments' and public.is_site_admin());
create policy contact_private_attachment_admin_update on storage.objects for update to authenticated using (bucket_id = 'contact-private-attachments' and public.is_site_admin()) with check (bucket_id = 'contact-private-attachments' and public.is_site_admin());
create policy contact_private_attachment_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'contact-private-attachments' and public.is_site_admin());
