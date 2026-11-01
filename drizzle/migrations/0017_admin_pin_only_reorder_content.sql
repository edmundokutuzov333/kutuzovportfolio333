create or replace function public.admin_reorder_content(
  p_entity_type text,
  p_ids uuid[],
  p_page_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table text;
  v_count bigint;
  v_matched_count bigint;
  v_offset bigint;
  v_before_map jsonb;
  v_id uuid;
  v_position bigint;
  v_after jsonb;
  v_revision bigint;
  v_scope text := '';
  v_scope_sql text := '';
begin
  if not (
    (p_actor_id is null and coalesce(auth.role(), '') = 'service_role')
    or (
      p_actor_id is not null
      and exists (
        select 1 from auth.users u
        where u.id = p_actor_id
          and u.deleted_at is null
          and u.raw_app_meta_data ->> 'site_role' = 'admin'
      )
    )
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as values_list(x)) then
    raise exception 'invalid_order_list' using errcode = '22023';
  end if;

  case p_entity_type
    when 'page_sections' then
      if p_page_id is null then raise exception 'page_scope_required' using errcode = '22023'; end if;
      v_table := 'page_sections'; v_scope := 'page_id'; v_scope_sql := ' where page_id = $1';
    when 'projects' then v_table := 'projects';
    when 'clients' then v_table := 'clients';
    when 'experience_items' then v_table := 'experience_items';
    when 'metrics' then v_table := 'metrics';
    when 'skills' then v_table := 'skills';
    when 'disciplines' then v_table := 'disciplines';
    when 'principles' then v_table := 'principles';
    when 'services' then v_table := 'services';
    when 'process_steps' then v_table := 'process_steps';
    else raise exception 'entity_not_reorderable' using errcode = '22023';
  end case;

  if v_table = 'page_sections' then
    execute 'select count(*) from public.page_sections where page_id = $1' into v_count using p_page_id;
    execute 'select count(*) from public.page_sections where page_id = $1 and id = any($2)' into v_matched_count using p_page_id,p_ids;
    if v_matched_count <> cardinality(p_ids) then
      raise exception 'invalid_order_scope' using errcode = '22023';
    end if;
    execute 'select jsonb_object_agg(id::text,to_jsonb(target.*)) from public.page_sections target where page_id = $1' into v_before_map using p_page_id;
    execute 'select coalesce(max(position),0) + cardinality($1) + 1000000 from public.page_sections where page_id=$2' into v_offset using p_ids,p_page_id;
    execute 'update public.page_sections set position = position + $2 where page_id = $1' using p_page_id,v_offset;
  else
    execute format('select count(*) from public.%I',v_table) into v_count;
    execute format('select count(*) from public.%I where id = any($1)',v_table) into v_matched_count using p_ids;
    if v_matched_count <> cardinality(p_ids) then
      raise exception 'invalid_order_scope' using errcode = '22023';
    end if;
    execute format('select jsonb_object_agg(id::text,to_jsonb(target.*)) from public.%I target',v_table) into v_before_map;
    execute format('select coalesce(max(position),0) + cardinality($1) + 1000000 from public.%I',v_table) into v_offset using p_ids;
    execute format('update public.%I set position = position + $1',v_table) using v_offset;
  end if;

  if v_count <> cardinality(p_ids) then
    raise exception 'order_must_include_every_record' using errcode = '22023';
  end if;

  for v_id, v_position in
    select requested.id, requested.ordinality - 1
    from unnest(p_ids) with ordinality as requested(id, ordinality)
  loop
    if v_table = 'page_sections' then
      update public.page_sections set position = v_position, updated_at = now(), updated_by = p_actor_id where id = v_id and page_id = p_page_id;
    elsif v_table = 'projects' then
      update public.projects set position = v_position, updated_at = now(), updated_by = p_actor_id where id = v_id;
    elsif v_table = 'clients' then
      update public.clients set position = v_position, updated_at = now(), updated_by = p_actor_id where id = v_id;
    else
      execute format('update public.%I set position = $1, updated_at=now() where id=$2',v_table) using v_position,v_id;
    end if;
  end loop;

  update public.site_publication_state
     set published_revision = published_revision + 1, published_at = now(), published_by = p_actor_id
   where singleton_key = 'primary'
   returning published_revision into v_revision;

  for v_id, v_position in
    select requested.id, requested.ordinality - 1
    from unnest(p_ids) with ordinality as requested(id, ordinality)
  loop
    execute format('select to_jsonb(target.*) from public.%I target where id = $1',v_table) into v_after using v_id;
    insert into public.content_revisions(entity_type,entity_id,action,before_snapshot,after_snapshot,note,publish_revision,actor_id)
    values (p_entity_type,v_id,'reorder',v_before_map -> v_id::text,v_after,'Order changed in Admin',v_revision,p_actor_id);
  end loop;

  insert into public.admin_audit_log(actor_id,event_type,success,subject,metadata)
  values (p_actor_id,'content_reorder',true,p_entity_type,jsonb_build_object('entity_type',p_entity_type,'count',cardinality(p_ids),'publish_revision',v_revision));

  return jsonb_build_object('count',cardinality(p_ids),'published_revision',v_revision);
end;
$function$;