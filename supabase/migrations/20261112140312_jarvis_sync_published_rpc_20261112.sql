-- JARVIS: idempotent synchronization of published CMS projects only.
-- Never updates legacy CMS tables or approves external sources.
create or replace function public.kb_sync_published()
returns jsonb language plpgsql security invoker
set search_path=public,extensions as $$
declare docs_count integer; chunk_count integer;
begin
  insert into public.kb_documents(source_type,source_ref,url,title,locale,visibility,status,content_hash)
  select 'site_db','project:'||p.slug,'https://www.edmundokutuzov.art/work/'||p.slug,
  p.title,'pt','public','verified',md5(concat_ws(E'\n',p.title,p.summary,p.challenge,p.idea,p.outcome))
  from public.projects p where p.status='published'
  on conflict(source_type,source_ref,locale) do update
  set title=excluded.title,url=excluded.url,content_hash=excluded.content_hash,status='verified',
      updated_at=now()
  where kb_documents.content_hash is distinct from excluded.content_hash or kb_documents.status<>'verified';

  insert into public.kb_chunks(document_id,chunk_index,locale,content,metadata)
  select d.id,0,'pt',
  left(concat_ws(E'\n',p.title||' > Projecto',
    'Cliente: '||coalesce(p.client_label,''),'Disciplina: '||coalesce(p.discipline,''),
    'Ano: '||coalesce(p.year_label,''),nullif(p.summary,''),nullif(p.challenge,''),
    nullif(p.idea,''),nullif(p.outcome,'')),1700),
  jsonb_build_object('slug',p.slug,'year',coalesce(p.year_label,''),
    'client',coalesce(p.client_label,''),'discipline',coalesce(p.discipline,''),'source','site_db')
  from public.projects p join public.kb_documents d
  on d.source_type='site_db' and d.source_ref='project:'||p.slug and d.locale='pt'
  where p.status='published'
  on conflict(document_id,chunk_index) do update
  set content=excluded.content,metadata=excluded.metadata
  where kb_chunks.content is distinct from excluded.content;

  update public.kb_documents d set status='deprecated',updated_at=now()
  where d.source_type='site_db' and d.source_ref like 'project:%'
  and d.status='verified'
  and not exists(select 1 from public.projects p
    where 'project:'||p.slug=d.source_ref and p.status='published');

  select count(*) into docs_count from public.kb_documents where status='verified' and source_type='site_db';
  select count(*) into chunk_count from public.kb_chunks c
    join public.kb_documents d on d.id=c.document_id where d.status='verified';
  return jsonb_build_object('verified_documents',docs_count,'verified_chunks',chunk_count);
end $$;
revoke all on function public.kb_sync_published() from public,anon,authenticated;
grant execute on function public.kb_sync_published() to service_role;
