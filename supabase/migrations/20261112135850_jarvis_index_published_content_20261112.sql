-- Additive, idempotent import of already published site content into the JARVIS index.
-- No pre-existing public CMS tables are modified.
with source as (
 select p.slug,p.title, concat_ws(E'\n',
  nullif(p.summary,''),nullif(p.challenge,''),nullif(p.idea,''),nullif(p.outcome,'')) as body
 from public.projects p where p.status='published'
)
insert into public.kb_documents(source_type,source_ref,url,title,locale,visibility,status,content_hash)
select 'site_db','project:'||s.slug,'https://www.edmundokutuzov.art/work/'||s.slug,
 s.title,'pt','public','verified',md5(s.title||coalesce(s.body,'')) from source s
on conflict(source_type,source_ref,locale) do update
set title=excluded.title,url=excluded.url,content_hash=excluded.content_hash,
 visibility='public',status='verified',updated_at=now()
where kb_documents.content_hash is distinct from excluded.content_hash
or kb_documents.status <> 'verified';

insert into public.kb_chunks(document_id,chunk_index,locale,content,metadata)
select d.id,0,'pt',
 left(concat_ws(E'\n',p.title||' > Projecto', 'Cliente: '||coalesce(p.client_label,''),
 'Disciplina: '||coalesce(p.discipline,''),'Ano: '||coalesce(p.year_label,''),
 nullif(p.summary,''),nullif(p.challenge,''),nullif(p.idea,''),nullif(p.outcome,'')),1700),
 jsonb_build_object('slug',p.slug,'year',coalesce(p.year_label,''),
 'client',coalesce(p.client_label,''),'discipline',coalesce(p.discipline,''),'source','site_db')
from public.projects p join public.kb_documents d on d.source_ref='project:'||p.slug
and d.source_type='site_db' and d.locale='pt'
where p.status='published'
on conflict(document_id,chunk_index) do update
set content=excluded.content,metadata=excluded.metadata
where kb_chunks.content is distinct from excluded.content;

insert into public.kb_documents(source_type,source_ref,url,title,locale,visibility,status,content_hash)
select 'site_db','service:'||slug,'https://www.edmundokutuzov.art/services',title,'pt','public','verified',
 md5(title||coalesce(description,'')) from public.services where is_published=true
on conflict(source_type,source_ref,locale) do update
set title=excluded.title,content_hash=excluded.content_hash,status='verified',updated_at=now()
where kb_documents.content_hash is distinct from excluded.content_hash or kb_documents.status<>'verified';

insert into public.kb_chunks(document_id,chunk_index,locale,content,metadata)
select d.id,0,'pt',left(s.title||' > Serviço: '||coalesce(s.description,''),1700),
 jsonb_build_object('slug',s.slug,'source','site_db')
from public.services s join public.kb_documents d on d.source_type='site_db'
and d.source_ref='service:'||s.slug and d.locale='pt'
where s.is_published=true
on conflict(document_id,chunk_index) do update
set content=excluded.content,metadata=excluded.metadata
where kb_chunks.content is distinct from excluded.content;

insert into public.kb_documents(source_type,source_ref,title,locale,visibility,status,content_hash)
select 'site_db','client:'||slug,name,'pt','public','verified',md5(name)
from public.clients where is_visible=true
on conflict(source_type,source_ref,locale) do update
set title=excluded.title,content_hash=excluded.content_hash,status='verified',updated_at=now()
where kb_documents.content_hash is distinct from excluded.content_hash or kb_documents.status<>'verified';

insert into public.kb_chunks(document_id,chunk_index,locale,content,metadata)
select d.id,0,'pt',c.name||' > Cliente do portfólio',jsonb_build_object('client',c.name,'source','site_db')
from public.clients c join public.kb_documents d on d.source_type='site_db'
and d.source_ref='client:'||c.slug and d.locale='pt'
where c.is_visible=true
on conflict(document_id,chunk_index) do update
set content=excluded.content,metadata=excluded.metadata
where kb_chunks.content is distinct from excluded.content;
