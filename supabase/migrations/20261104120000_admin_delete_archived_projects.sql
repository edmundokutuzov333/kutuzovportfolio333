-- Permanent deletion is intentionally restricted to projects already archived.
-- The Admin server calls this function with service_role after the PIN session
-- has been verified. Every deletion remains auditable through a revision and log.

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
    from pg_constraint
   where conrelid = 'public.content_revisions'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%action%';
  if v_constraint is not null then
    execute format('alter table public.content_revisions drop constraint %I', v_constraint);
  end if;
  alter table public.content_revisions
    add constraint content_revisions_action_check
    check (action in ('create','update','publish','archive','restore','reorder','delete'));
end;
$$;

create or replace function public.admin_delete_archived_project(
  p_entity_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb;
  v_revision bigint;
  v_updated_at timestamptz;
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

  if p_entity_id is null or p_expected_updated_at is null then
    raise exception 'conflict_token_required' using errcode = '22023';
  end if;

  select to_jsonb(p), p.updated_at
    into v_before, v_updated_at
    from public.projects p
   where p.id = p_entity_id;

  if v_before is null then
    raise exception 'record_not_found' using errcode = 'P0002';
  end if;
  if v_updated_at is distinct from p_expected_updated_at then
    raise exception 'record_conflict_or_missing' using errcode = '40001';
  end if;
  if v_before ->> 'status' <> 'archived' then
    raise exception 'project_must_be_archived_first' using errcode = '22023';
  end if;

  delete from public.projects where id = p_entity_id;

  update public.site_publication_state
     set published_revision = published_revision + 1,
         published_at = now(),
         published_by = p_actor_id
   where singleton_key = 'primary'
   returning published_revision into v_revision;

  insert into public.content_revisions(
    entity_type, entity_id, action, before_snapshot, after_snapshot,
    note, publish_revision, actor_id
  ) values (
    'projects', p_entity_id, 'delete', v_before, null,
    coalesce(p_note, 'Permanent deletion in Admin'), v_revision, p_actor_id
  );

  insert into public.admin_audit_log(actor_id, event_type, success, subject, metadata)
  values (
    p_actor_id, 'content_delete', true, 'projects',
    jsonb_build_object('entity_id', p_entity_id, 'publish_revision', v_revision)
  );

  return jsonb_build_object('record', v_before, 'published_revision', v_revision);
end;
$function$;

revoke all on function public.admin_delete_archived_project(uuid,timestamptz,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_delete_archived_project(uuid,timestamptz,uuid,text) to service_role;
