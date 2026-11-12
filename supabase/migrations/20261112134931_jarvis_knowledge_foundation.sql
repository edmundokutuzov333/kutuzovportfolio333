-- JARVIS knowledge foundation. Additive: creates only new kb_* objects.
create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.kb_state (
  id integer primary key default 1 check (id = 1),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.kb_state(id) values (1) on conflict (id) do nothing;

create table if not exists public.kb_facts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  locale text not null default 'all' check (locale in ('all','pt','en')),
  value text not null,
  spoken text,
  priority integer not null default 100,
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'pending_review' check (status in ('verified','pending_review','rejected','deprecated')),
  source text not null,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (key,locale)
);
create index if not exists kb_facts_public_lookup on public.kb_facts (key,locale) where visibility='public' and status='verified';

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_ref text,
  url text,
  title text not null,
  locale text not null check (locale in ('all','pt','en')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'pending_review' check (status in ('verified','pending_review','rejected','deprecated')),
  content_hash text not null,
  updated_at timestamptz not null default now(),
  unique (source_type, source_ref, locale)
);
create index if not exists kb_docs_approved on public.kb_documents(status,visibility,locale);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  chunk_index integer not null default 0,
  locale text not null check (locale in ('all','pt','en')),
  content text not null,
  content_tsv tsvector,
  embedding extensions.vector(768),
  metadata jsonb not null default '{}'::jsonb,
  unique(document_id,chunk_index)
);
create index if not exists kb_chunks_fts on public.kb_chunks using gin(content_tsv);
create index if not exists kb_chunks_embedding on public.kb_chunks using hnsw(embedding vector_cosine_ops);
create index if not exists kb_chunks_document on public.kb_chunks(document_id);

create table if not exists public.kb_query_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  session_hash text,
  modality text,
  locale text,
  query_redacted text,
  tier_used text,
  chunk_ids uuid[],
  t_embed_ms integer,
  t_search_ms integer,
  t_total_ms integer,
  answered boolean,
  flagged boolean not null default false,
  flag_reason text
);
create index if not exists kb_query_log_ts on public.kb_query_log(ts desc);

create table if not exists public.kb_fact_revisions (
  id bigserial primary key,
  fact_key text not null,
  locale text not null,
  old_fact jsonb,
  new_fact jsonb,
  changed_at timestamptz not null default now(),
  operation text not null
);

create table if not exists public.kb_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  requests integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.kb_fill_tsv() returns trigger language plpgsql
set search_path=public,extensions as $$
begin
  new.content_tsv := to_tsvector('simple', extensions.unaccent(coalesce(new.content,'')));
  return new;
end $$;
drop trigger if exists kb_chunks_tsv_update on public.kb_chunks;
create trigger kb_chunks_tsv_update before insert or update of content on public.kb_chunks
for each row execute function public.kb_fill_tsv();

create or replace function public.kb_bump_version() returns trigger language plpgsql
set search_path=public as $$
begin
  update public.kb_state set version=version+1,updated_at=now() where id=1;
  return coalesce(new,old);
end $$;
drop trigger if exists kb_facts_bump on public.kb_facts;
create trigger kb_facts_bump after insert or update or delete on public.kb_facts
for each statement execute function public.kb_bump_version();
drop trigger if exists kb_documents_bump on public.kb_documents;
create trigger kb_documents_bump after insert or update or delete on public.kb_documents
for each statement execute function public.kb_bump_version();

create or replace function public.kb_log_fact_revision() returns trigger language plpgsql
set search_path=public as $$
begin
  insert into public.kb_fact_revisions(fact_key,locale,old_fact,new_fact,operation)
  values (coalesce(new.key,old.key),coalesce(new.locale,old.locale),
          case when tg_op='INSERT' then null else to_jsonb(old) end,
          case when tg_op='DELETE' then null else to_jsonb(new) end,tg_op);
  return coalesce(new,old);
end $$;
drop trigger if exists kb_facts_audit on public.kb_facts;
create trigger kb_facts_audit after insert or update or delete on public.kb_facts
for each row execute function public.kb_log_fact_revision();

create or replace function public.kb_acquire_rate_slot(p_bucket text,p_max integer default 25,p_window_seconds integer default 60)
returns boolean language plpgsql security invoker
set search_path=public as $$
declare n integer;
begin
  if length(coalesce(p_bucket,''))<20 or p_max<1 or p_max>100 or p_window_seconds<30 then return false; end if;
  insert into public.kb_rate_limits(bucket,window_start,requests,updated_at)
  values(p_bucket,now(),1,now())
  on conflict(bucket) do update
  set requests=case when kb_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else kb_rate_limits.requests+1 end,
      window_start=case when kb_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else kb_rate_limits.window_start end,
      updated_at=now()
  returning requests into n;
  return n<=p_max;
end $$;

create or replace function public.kb_hybrid_search(
  q_text text, q_emb extensions.vector(768) default null,
  q_locale text default 'pt', k integer default 5
) returns table(id uuid,content text,metadata jsonb,score double precision)
language sql stable security invoker set search_path=public,extensions as $$
with lexical_top as (
 select c.id, ts_rank_cd(c.content_tsv, plainto_tsquery('simple',extensions.unaccent(q_text))) as relevance
 from public.kb_chunks c join public.kb_documents d on d.id=c.document_id
 where d.status='verified' and d.visibility='public' and d.locale in ('all',q_locale)
 and c.content_tsv @@ plainto_tsquery('simple',extensions.unaccent(q_text))
 order by relevance desc limit 30
), lexical as (
 select id,row_number() over(order by relevance desc) as rn from lexical_top
), vector_top as (
 select c.id,(c.embedding <=> q_emb) as distance
 from public.kb_chunks c join public.kb_documents d on d.id=c.document_id
 where q_emb is not null and c.embedding is not null
 and d.status='verified' and d.visibility='public' and d.locale in ('all',q_locale)
 order by distance limit 30
), semantic as (
 select id,row_number() over(order by distance) as rn from vector_top
)
select c.id,c.content,c.metadata,
 (coalesce(1.0/(60+lexical.rn),0)+coalesce(1.0/(60+semantic.rn),0))::double precision as score
from lexical full outer join semantic on lexical.id=semantic.id
join public.kb_chunks c on c.id=coalesce(lexical.id,semantic.id)
order by score desc limit least(greatest(k,1),6)
$$;

-- Private-only: no policy for anon/authenticated. Server service_role bypasses RLS.
alter table public.kb_state enable row level security;
alter table public.kb_facts enable row level security;
alter table public.kb_documents enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.kb_query_log enable row level security;
alter table public.kb_fact_revisions enable row level security;
alter table public.kb_rate_limits enable row level security;
revoke all on public.kb_state,public.kb_facts,public.kb_documents,public.kb_chunks,
  public.kb_query_log,public.kb_fact_revisions,public.kb_rate_limits from anon,authenticated;
revoke all on function public.kb_hybrid_search(text,extensions.vector, text,integer) from public,anon,authenticated;
revoke all on function public.kb_acquire_rate_slot(text,integer,integer) from public,anon,authenticated;
grant usage on schema public to service_role;
grant all on public.kb_state,public.kb_facts,public.kb_documents,public.kb_chunks,
  public.kb_query_log,public.kb_fact_revisions,public.kb_rate_limits to service_role;
grant usage,select on sequence public.kb_query_log_id_seq,public.kb_fact_revisions_id_seq to service_role;
grant execute on function public.kb_hybrid_search(text,extensions.vector,text,integer) to service_role;
grant execute on function public.kb_acquire_rate_slot(text,integer,integer) to service_role;

-- Canonical seed: use already published site data instead of conflicting handwritten claims.
insert into public.kb_facts(key,locale,value,spoken,visibility,status,source,verified_at,priority)
select key,'all',value,spoken,'public','verified','site_db:profile_content',now(),priority from (
 select 'identity.name' as key,name as value,null::text spoken,10 priority
 from public.profile_content where is_published=true
 union all select 'identity.roles',array_to_string(roles,' / '),null,20
 from public.profile_content where is_published=true
 union all select 'identity.location',location,null,30
 from public.profile_content where is_published=true
 union all select 'identity.tagline',headline,null,30
 from public.profile_content where is_published=true
 union all select 'contact.email',public_email,'contact arroba edmundokutuzov ponto art',1
 from public.profile_content where is_published=true and public_email='contact@edmundokutuzov.art'
 union all select 'contact.phone',phone,null,10
 from public.profile_content where is_published=true
 union all select 'contact.whatsapp',whatsapp,'mais dois cinco oito, oito sete, seis zero um, três um dois um',10
 from public.profile_content where is_published=true
 union all select 'contact.site','https://www.edmundokutuzov.art',null,10
 from public.profile_content where is_published=true
 union all select 'social.linkedin',social->>'href',null,40
 from public.profile_content p cross join lateral jsonb_array_elements(p.socials) social
 where p.is_published=true and lower(social->>'label')='linkedin'
 union all select 'social.instagram',social->>'href',null,40
 from public.profile_content p cross join lateral jsonb_array_elements(p.socials) social
 where p.is_published=true and lower(social->>'label')='instagram'
 union all select 'assistant.name','JARVIS DO KUTUZOV',null,10
 from public.profile_content where is_published=true
) canon where value is not null and value<>''
on conflict(key,locale) do nothing;

insert into public.kb_facts(key,locale,value,visibility,status,source,verified_at,priority)
select 'stats.'||regexp_replace(lower(label),'[^a-z0-9]+','_','g'),'all',value,'public','verified','site_db:metrics',now(),60
from public.metrics where is_published=true
on conflict(key,locale) do nothing;
insert into public.kb_facts(key,locale,value,visibility,status,source,verified_at,priority)
select 'service.'||slug,'all',title||': '||description,'public','verified','site_db:services',now(),70
from public.services where is_published=true
on conflict(key,locale) do nothing;
insert into public.kb_facts(key,locale,value,visibility,status,source,verified_at,priority)
select 'value.'||lower(title),'all',title||': '||description,'public','verified','site_db:principles',now(),75
from public.principles where is_published=true
on conflict(key,locale) do nothing;
insert into public.kb_facts(key,locale,value,visibility,status,source,verified_at,priority)
select 'client.'||slug,'all',name,'public','verified','site_db:clients',now(),90
from public.clients where is_visible=true
on conflict(key,locale) do nothing;

-- Explicit conflict: neither Facebook handle is approved for assistant replies.
insert into public.kb_facts(key,locale,value,visibility,status,source,priority) values
('social.facebook.candidate.site','all','https://www.facebook.com/edmundoku/','public','pending_review','site_db:profile_content',120),
('social.facebook.candidate.owner','all','https://www.facebook.com/edmundo.kutuzov2003/','public','pending_review','owner_brief:2026-11-12',120)
on conflict(key,locale) do nothing;

-- Always fail closed on an unverified availability claim.
insert into public.kb_facts(key,locale,value,visibility,status,source,priority)
values('availability','all','O site indica disponibilidade para projectos, sujeita a confirmação.','public','pending_review','owner_brief:2026-11-12',100)
on conflict(key,locale) do nothing;
