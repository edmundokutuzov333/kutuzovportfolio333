-- Phase 3: server-only, optimistic and auditable editorial mutations.
alter table public.projects add column if not exists gallery_alt jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery_alt) = 'array');
-- Functions are callable only with the server service role; every server handler must first call requireAdmin().
-- The actor UUID is additionally checked against the trusted app_metadata role before any write.

create or replace function public.admin_mutate_content(
  p_entity_type text,
  p_action text,
  p_entity_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table text;
  v_allowed text[];
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_key text;
  v_columns text;
  v_select_columns text;
  v_set_clause text;
  v_before jsonb;
  v_after jsonb;
  v_revision bigint;
  v_revision_action text;
  v_page_id uuid;
  v_section_type text;
  v_positions_before jsonb;
  v_sibling_after jsonb;
  v_row_count bigint;
  v_offset bigint;
  v_target_position integer;
  v_reorder_position integer;
  v_reorder_id uuid;
begin
  if p_actor_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_actor_id
      and u.deleted_at is null
      and u.raw_app_meta_data ->> 'site_role' = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_action not in ('create','update','publish','archive','restore') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'payload_must_be_object' using errcode = '22023';
  end if;

  case p_entity_type
    when 'pages' then
      v_table := 'pages';
      v_allowed := array['slug','route_path','title','locale','status','seo_title','seo_description','canonical_url','og_image_path','published_at'];
    when 'page_sections' then
      v_table := 'page_sections';
      v_allowed := array['page_id','section_key','section_type','position','is_visible','config'];
    when 'projects' then
      v_table := 'projects';
      v_allowed := array['slug','title','client_id','client_label','year_label','discipline','project_type','summary','challenge','idea','outcome','cover_path','cover_alt','gallery','gallery_alt','featured','position','status','hue','locale','published_at'];
    when 'clients' then
      v_table := 'clients';
      v_allowed := array['slug','name','logo_path','logo_alt','display_as_text','position','show_on_home','show_on_clients_page','is_visible'];
    when 'profile_content' then
      v_table := 'profile_content';
      v_allowed := array['name','role','roles','biography','location','portrait_path','public_email','socials','is_published','address','phone','whatsapp','headline','intro'];
    when 'experience_items' then
      v_table := 'experience_items';
      v_allowed := array['organisation','role','period','description','position','is_published'];
    when 'metrics' then
      v_table := 'metrics';
      v_allowed := array['label','value','note','position','is_published'];
    when 'skills' then
      v_table := 'skills';
      v_allowed := array['name','level','category','value','tier','position','is_published'];
    when 'disciplines' then
      v_table := 'disciplines';
      v_allowed := array['name','description','items','position','is_published'];
    when 'principles' then
      v_table := 'principles';
      v_allowed := array['title','description','position','is_published'];
    when 'services' then
      v_table := 'services';
      v_allowed := array['slug','title','description','details','number_label','line','position','is_published'];
    when 'process_steps' then
      v_table := 'process_steps';
      v_allowed := array['step_key','title','description','number_label','position','is_published'];
    when 'site_settings' then
      v_table := 'site_settings';
      v_allowed := array['setting_value','is_public'];
    else
      raise exception 'entity_not_editable' using errcode = '22023';
  end case;

  if p_entity_type = 'site_settings' and (p_entity_id is null or p_action in ('create','archive')) then
    raise exception 'settings_must_be_updated_not_created_or_archived' using errcode = '22023';
  end if;
  if p_entity_type = 'profile_content' and (p_entity_id is null or p_action in ('create','archive')) then
    raise exception 'profile_content_must_be_updated_not_created_or_archived' using errcode = '22023';
  end if;
  if p_entity_id is not null and p_action <> 'restore'
     and p_entity_type in ('page_sections','projects','clients','experience_items','metrics','skills','disciplines','principles','services','process_steps')
     and v_payload ? 'position' then
    raise exception 'use_reorder_rpc_for_position' using errcode = '22023';
  end if;

  if p_action = 'restore' then
    v_payload := v_payload - array['id','created_at','updated_at','created_by','updated_by','actor_id','publish_revision'];
  elsif p_action = 'archive' then
    if v_table in ('pages','projects') then
      v_payload := jsonb_build_object('status','archived');
    elsif v_table = 'clients' then
      v_payload := jsonb_build_object('is_visible',false);
    elsif v_table in ('profile_content','experience_items','metrics','skills','disciplines','principles','services','process_steps') then
      v_payload := jsonb_build_object('is_published',false);
    elsif v_table = 'page_sections' then
      v_payload := jsonb_build_object('is_visible',false);
    else
      raise exception 'archive_not_supported_for_entity' using errcode = '22023';
    end if;
  elsif p_action = 'publish' then
    if v_table in ('pages','projects') then
      v_payload := v_payload || jsonb_build_object('status','published');
    elsif v_table in ('profile_content','experience_items','metrics','skills','disciplines','principles','services','process_steps') then
      v_payload := v_payload || jsonb_build_object('is_published',true);
    end if;
  end if;

  -- Publication timestamps are generated by the database, not trusted from the client.
  if p_action = 'publish' and v_table in ('pages','projects') then
    v_payload := v_payload || jsonb_build_object('published_at',now());
  end if;

  for v_key in select jsonb_object_keys(v_payload) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'field_not_editable: %', v_key using errcode = '22023';
    end if;
  end loop;

  if p_entity_type = 'page_sections' then
    v_page_id := case when v_payload ? 'page_id' then (v_payload ->> 'page_id')::uuid else null end;
    v_section_type := v_payload ->> 'section_type';
    if p_entity_id is not null then
      select coalesce(v_page_id, (s.page_id)) into v_page_id
      from public.page_sections s where s.id = p_entity_id;
      if v_section_type is null then
        select s.section_type into v_section_type from public.page_sections s where s.id = p_entity_id;
      end if;
    end if;
    if v_page_id is not null and v_section_type is not null
       and exists (select 1 from public.pages p where p.id = v_page_id and p.route_path = '/')
       and v_section_type not in ('hero','manifesto','featured_work','services','metrics','clients','principles') then
      raise exception 'unsupported_home_section_type' using errcode = '22023';
    end if;
  end if;

  if p_entity_id is null then
    if p_action not in ('create','publish') then
      raise exception 'entity_id_required' using errcode = '22023';
    end if;
    if jsonb_object_length(v_payload) = 0 then
      raise exception 'empty_create_payload' using errcode = '22023';
    end if;

    if p_entity_type = 'projects' and
       jsonb_array_length(coalesce(v_payload -> 'gallery','[]'::jsonb)) <>
       jsonb_array_length(coalesce(v_payload -> 'gallery_alt','[]'::jsonb)) then
      raise exception 'gallery_alt_count_mismatch' using errcode = '22023';
    end if;

    if p_entity_type in ('page_sections','projects','clients','experience_items','metrics','skills','disciplines','principles','services','process_steps') then
      if not (v_payload ? 'position') then
        raise exception 'position_required' using errcode = '22023';
      end if;
      if p_entity_type = 'page_sections' then
        execute 'select coalesce(max(position) + 1,0) from public.page_sections where page_id = $1'
          into v_row_count using (v_payload ->> 'page_id')::uuid;
      else
        execute format('select coalesce(max(position) + 1,0) from public.%I',v_table)
          into v_row_count;
      end if;
      if (v_payload ->> 'position')::integer <> v_row_count then
        raise exception 'invalid_create_position' using errcode = '22023';
      end if;
    end if;

    if v_table in ('pages','clients','projects') then
      v_payload := v_payload || jsonb_build_object('created_by',p_actor_id,'updated_by',p_actor_id);
    elsif v_table = 'page_sections' then
      v_payload := v_payload || jsonb_build_object('updated_by',p_actor_id);
    elsif v_table in ('profile_content','site_settings') then
      v_payload := v_payload || jsonb_build_object('updated_by',p_actor_id);
    end if;

    select string_agg(format('%I', key), ', ' order by key),
           string_agg(format('source.%I', key), ', ' order by key)
      into v_columns, v_select_columns
    from jsonb_object_keys(v_payload) as fields(key);

    execute format(
      'insert into public.%I as target (%s) select %s from jsonb_populate_record(null::public.%I, $1) as source returning to_jsonb(target.*)',
      v_table, v_columns, v_select_columns, v_table
    ) into v_after using v_payload;
    v_revision_action := 'create';
  else
    if p_expected_updated_at is null then
      raise exception 'conflict_token_required' using errcode = '22023';
    end if;

    execute format('select to_jsonb(target.*) from public.%I as target where target.id = $1', v_table)
      into v_before using p_entity_id;
    if v_before is null then
      raise exception 'record_not_found' using errcode = 'P0002';
    end if;

    if p_entity_type = 'page_sections' and v_payload ? 'page_id'
       and (v_payload ->> 'page_id') is distinct from (v_before ->> 'page_id') then
      raise exception 'section_page_is_immutable' using errcode = '22023';
    end if;
    if p_entity_type = 'projects' and
       jsonb_array_length(coalesce(case when v_payload ? 'gallery' then v_payload -> 'gallery' else v_before -> 'gallery' end,'[]'::jsonb)) <>
       jsonb_array_length(coalesce(case when v_payload ? 'gallery_alt' then v_payload -> 'gallery_alt' else v_before -> 'gallery_alt' end,'[]'::jsonb)) then
      raise exception 'gallery_alt_count_mismatch' using errcode = '22023';
    end if;

    -- Restore an earlier list position without violating unique-position constraints.
    -- Sibling moves are snapshotted and audited in the same transaction as the target restore.
    if p_action = 'restore' and v_payload ? 'position'
       and (v_before ->> 'position')::integer is distinct from (v_payload ->> 'position')::integer
       and p_entity_type in ('page_sections','projects','clients','experience_items','metrics','skills','disciplines','principles','services','process_steps') then
      v_target_position := (v_payload ->> 'position')::integer;
      if p_entity_type = 'page_sections' then
        v_page_id := (v_before ->> 'page_id')::uuid;
        select count(*) into v_row_count from public.page_sections where page_id = v_page_id;
        if v_target_position < 0 or v_target_position >= v_row_count then
          raise exception 'invalid_restore_position' using errcode = '22023';
        end if;
        select coalesce(max(position),0) + v_row_count + 1000000 into v_offset from public.page_sections where page_id = v_page_id;
        select jsonb_object_agg(id::text,to_jsonb(target.*)) into v_positions_before from public.page_sections target where page_id = v_page_id;
        update public.page_sections set position = position + v_offset where page_id = v_page_id;
        v_reorder_position := 0;
        for v_reorder_id in select id from public.page_sections where page_id = v_page_id and id <> p_entity_id order by position asc loop
          if v_reorder_position >= v_target_position then v_reorder_position := v_reorder_position + 1; end if;
          if (v_positions_before -> v_reorder_id::text ->> 'position')::integer is distinct from v_reorder_position then
            update public.page_sections set position = v_reorder_position, updated_at = now(), updated_by = p_actor_id where id = v_reorder_id;
          else
            update public.page_sections set position = v_reorder_position where id = v_reorder_id;
          end if;
          v_reorder_position := v_reorder_position + 1;
        end loop;
      else
        execute format('select count(*) from public.%I',v_table) into v_row_count;
        if v_target_position < 0 or v_target_position >= v_row_count then
          raise exception 'invalid_restore_position' using errcode = '22023';
        end if;
        execute format('select coalesce(max(position),0) + $1 + 1000000 from public.%I',v_table) into v_offset using v_row_count;
        execute format('select jsonb_object_agg(id::text,to_jsonb(target.*)) from public.%I target',v_table) into v_positions_before;
        execute format('update public.%I set position = position + $1',v_table) using v_offset;
        v_reorder_position := 0;
        for v_reorder_id in execute format('select id from public.%I where id <> $1 order by position asc',v_table) using p_entity_id loop
          if v_reorder_position >= v_target_position then v_reorder_position := v_reorder_position + 1; end if;
          execute format('update public.%I set position = $1, updated_at = case when position is distinct from $1 then now() else updated_at end where id = $2',v_table) using v_reorder_position,v_reorder_id;
          v_reorder_position := v_reorder_position + 1;
        end loop;
      end if;
    end if;

    -- Published project slug changes preserve old URLs and flatten existing redirects to avoid chains.
    if p_entity_type = 'projects' and v_payload ? 'slug'
       and (v_payload ->> 'slug') is distinct from (v_before ->> 'slug') then
      if exists (select 1 from public.slug_redirects r where r.is_active and r.old_slug = v_payload ->> 'slug') then
        raise exception 'slug_is_redirect_source' using errcode = '22023';
      end if;
      update public.slug_redirects
         set new_slug = v_payload ->> 'slug'
       where is_active and new_slug = v_before ->> 'slug';
      insert into public.slug_redirects(old_slug,new_slug,is_active,created_by)
      values (v_before ->> 'slug',v_payload ->> 'slug',true,p_actor_id)
      on conflict (old_slug) do update set new_slug=excluded.new_slug,is_active=true,created_by=excluded.created_by;
    end if;

    if v_table in ('pages','page_sections','clients','projects') then
      v_payload := v_payload || jsonb_build_object('updated_by',p_actor_id);
    elsif v_table in ('profile_content','site_settings') then
      v_payload := v_payload || jsonb_build_object('updated_by',p_actor_id);
    end if;

    if jsonb_object_length(v_payload) = 0 then
      raise exception 'empty_update_payload' using errcode = '22023';
    end if;

    select string_agg(format('%1$I = source.%1$I', key), ', ' order by key)
      into v_set_clause
    from jsonb_object_keys(v_payload) as fields(key);

    if v_set_clause is null then
      raise exception 'empty_update_payload' using errcode = '22023';
    end if;

    execute format(
      'update public.%I as target set %s, updated_at = now() from jsonb_populate_record(null::public.%I, $1) as source where target.id = $2 and target.updated_at = $3 returning to_jsonb(target.*)',
      v_table, v_set_clause, v_table
    ) into v_after using v_payload, p_entity_id, p_expected_updated_at;

    if v_after is null then
      raise exception 'record_conflict_or_missing' using errcode = '40001';
    end if;

    v_revision_action := case
      when p_action = 'restore' then 'restore'
      when p_action = 'archive' then 'archive'
      when p_action = 'publish' then 'publish'
      else 'update'
    end;
  end if;

  update public.site_publication_state
     set published_revision = published_revision + 1,
         published_at = now(), published_by = p_actor_id
   where singleton_key = 'primary'
   returning published_revision into v_revision;

  insert into public.content_revisions(
    entity_type, entity_id, action, before_snapshot, after_snapshot,
    note, publish_revision, actor_id
  ) values (
    p_entity_type, (v_after ->> 'id')::uuid, v_revision_action, v_before,
    v_after, nullif(trim(coalesce(p_note,'')),''), v_revision, p_actor_id
  );

  if v_positions_before is not null then
    for v_reorder_id in select key::uuid from jsonb_each(v_positions_before) where key <> p_entity_id::text loop
      execute format('select to_jsonb(target.*) from public.%I target where id = $1',v_table) into v_sibling_after using v_reorder_id;
      if (v_positions_before -> v_reorder_id::text ->> 'position')::integer is distinct from (v_sibling_after ->> 'position')::integer then
        insert into public.content_revisions(
          entity_type, entity_id, action, before_snapshot, after_snapshot,
          note, publish_revision, actor_id
        ) values (
          p_entity_type, v_reorder_id, 'reorder', v_positions_before -> v_reorder_id::text,
          v_sibling_after, 'Position adjusted during restore', v_revision, p_actor_id
        );
      end if;
    end loop;
  end if;

  insert into public.admin_audit_log(actor_id,event_type,success,subject,metadata)
  values (
    p_actor_id, 'content_' || v_revision_action, true,
    p_entity_type || ':' || (v_after ->> 'id'),
    jsonb_build_object('entity_type',p_entity_type,'entity_id',v_after ->> 'id','publish_revision',v_revision)
  );

  return jsonb_build_object('record',v_after,'published_revision',v_revision);
end;
$function$;

revoke all on function public.admin_mutate_content(text,text,uuid,jsonb,timestamptz,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_mutate_content(text,text,uuid,jsonb,timestamptz,uuid,text) to service_role;

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
  if p_actor_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_actor_id and u.deleted_at is null
      and u.raw_app_meta_data ->> 'site_role' = 'admin'
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

revoke all on function public.admin_reorder_content(text,uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_reorder_content(text,uuid[],uuid,uuid) to service_role;

create or replace function public.admin_update_contact_submission(
  p_submission_id uuid,
  p_status text,
  p_internal_notes text,
  p_expected_updated_at timestamptz,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_actor_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_actor_id and u.deleted_at is null
      and u.raw_app_meta_data ->> 'site_role' = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_status not in ('new','in_review','replied','archived') then
    raise exception 'invalid_contact_status' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    raise exception 'conflict_token_required' using errcode = '22023';
  end if;
  select to_jsonb(s) into v_before from public.contact_submissions s where s.id=p_submission_id;
  if v_before is null then raise exception 'record_not_found' using errcode = 'P0002'; end if;
  update public.contact_submissions s
    set status=p_status, internal_notes=left(coalesce(p_internal_notes,''),4000), updated_at=now()
    where s.id=p_submission_id and s.updated_at=p_expected_updated_at
    returning to_jsonb(s) into v_after;
  if v_after is null then raise exception 'record_conflict_or_missing' using errcode = '40001'; end if;
  insert into public.admin_audit_log(actor_id,event_type,success,subject,metadata)
  values (p_actor_id,'contact_submission_updated',true,p_submission_id::text,
    jsonb_build_object('status',p_status));
  return jsonb_build_object('record',v_after);
end;
$function$;

revoke all on function public.admin_update_contact_submission(uuid,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.admin_update_contact_submission(uuid,text,text,timestamptz,uuid) to service_role;
