-- Additive JARVIS semantic embedding maintenance. Only KB-owned objects.
create or replace function public.kb_fill_tsv() returns trigger language plpgsql
set search_path=public,extensions as $$
begin
  new.content_tsv := to_tsvector('simple', extensions.unaccent(coalesce(new.content,'')));
  if tg_op = 'UPDATE' and new.content is distinct from old.content then
    new.embedding := null;
    new.metadata := coalesce(new.metadata,'{}'::jsonb) - 'embedding_model';
  end if;
  return new;
end $$;

create or replace function public.kb_store_embeddings(p_rows jsonb)
returns integer language plpgsql security invoker
set search_path=public,extensions as $$
declare result_count integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>40 then
    raise exception 'invalid_embedding_batch';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where
    jsonb_array_length(r->'values')<>768 or coalesce(r->>'model','')<>'gemini-embedding-2') then
    raise exception 'invalid_embedding_dimensions_or_model';
  end if;

  update public.kb_chunks c set
    embedding=(row.values)::extensions.vector(768),
    metadata=c.metadata || jsonb_build_object('embedding_model','gemini-embedding-2')
  from jsonb_to_recordset(p_rows) as row(id uuid,values text,model text)
  join public.kb_chunks approved on approved.id=row.id
  join public.kb_documents d on d.id=approved.document_id
  where c.id=row.id and c.embedding is null
    and d.visibility='public' and d.status='verified';

  get diagnostics result_count=row_count;
  return result_count;
end $$;
revoke all on function public.kb_store_embeddings(jsonb) from public,anon,authenticated;
grant execute on function public.kb_store_embeddings(jsonb) to service_role;