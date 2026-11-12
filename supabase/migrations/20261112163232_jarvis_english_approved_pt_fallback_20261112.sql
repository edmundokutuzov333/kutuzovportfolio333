-- Fallback to approved PT source for English enquiries when EN editorial drafts are not verified.
-- JARVIS hybrid search: tokenized OR lexical match, stronger on partial names.
-- Keeps RRF, vector ranking, top-30 per branch, approved+public filtering.
create or replace function public.kb_hybrid_search(
  q_text text,q_emb extensions.vector(768) default null,q_locale text default 'pt',k integer default 5
) returns table(id uuid,content text,metadata jsonb,score double precision)
language sql stable security invoker set search_path=public,extensions as $$
with input as (
 select to_tsquery('simple',array_to_string(
  regexp_split_to_array(trim(regexp_replace(
   lower(extensions.unaccent(left(coalesce(q_text,''),200))),
   '[^[:alnum:]]+',' ','g')),E'\\s+'),' | ')) as words
), lexical_top as (
 select c.id,
   ts_rank_cd(c.content_tsv, input.words) as relevance
 from public.kb_chunks c
 join public.kb_documents d on d.id=c.document_id
 cross join input
 where d.status='verified' and d.visibility='public' and (d.locale in ('all',q_locale) or (q_locale='en' and d.locale='pt'))
 and c.content_tsv @@ input.words
 order by relevance desc limit 30
), lexical as (
 select id,row_number() over(order by relevance desc) as rn from lexical_top
), vector_top as (
 select c.id,(c.embedding <=> q_emb) as distance
 from public.kb_chunks c join public.kb_documents d on d.id=c.document_id
 where q_emb is not null and c.embedding is not null
 and d.status='verified' and d.visibility='public' and (d.locale in ('all',q_locale) or (q_locale='en' and d.locale='pt'))
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
revoke all on function public.kb_hybrid_search(text,extensions.vector,text,integer) from public,anon,authenticated;
grant execute on function public.kb_hybrid_search(text,extensions.vector,text,integer) to service_role;
