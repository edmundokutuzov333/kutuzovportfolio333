-- Phase 4: public form rate limits, durable submissions, double opt-in and recoverable email delivery.
alter table public.contact_submissions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $metadata_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contact_submissions'::regclass
      and conname = 'contact_submissions_metadata_object_check'
  ) then
    alter table public.contact_submissions
      add constraint contact_submissions_metadata_object_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end;
$metadata_constraint$;

create table if not exists public.public_form_rate_limits (
  purpose text not null check (purpose in ('contact','newsletter','newsletter_action')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (purpose, key_hash)
);

create index if not exists public_form_rate_limits_updated_idx
  on public.public_form_rate_limits(updated_at);

alter table public.public_form_rate_limits enable row level security;
revoke all on public.public_form_rate_limits from public, anon, authenticated;
grant all on public.public_form_rate_limits to service_role;

create or replace function public.consume_public_form_rate_limit(
  p_purpose text,
  p_key_hash text,
  p_now timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_limit integer;
begin
  if p_purpose not in ('contact','newsletter','newsletter_action')
     or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_rate_limit_key' using errcode = '22023';
  end if;
  v_limit := case p_purpose when 'contact' then 5 when 'newsletter' then 8 else 20 end;

  insert into public.public_form_rate_limits(
    purpose,key_hash,window_started_at,request_count,updated_at
  ) values (p_purpose,p_key_hash,p_now,1,p_now)
  on conflict (purpose,key_hash) do update
    set window_started_at = case
          when p_now - public.public_form_rate_limits.window_started_at >= interval '15 minutes'
          then p_now
          else public.public_form_rate_limits.window_started_at
        end,
        request_count = case
          when p_now - public.public_form_rate_limits.window_started_at >= interval '15 minutes'
          then 1
          else public.public_form_rate_limits.request_count + 1
        end,
        updated_at = p_now
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$function$;

revoke all on function public.consume_public_form_rate_limit(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.consume_public_form_rate_limit(text,text,timestamptz) to service_role;