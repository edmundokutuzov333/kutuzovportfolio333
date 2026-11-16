-- Atomic, optimistic reordering of PUBLIC portfolio projects only.
-- Compatible with the existing PIN-only Admin: all calls arrive server-side
-- using the existing service_role REST client; no auth configuration changes.
create or replace function public.admin_reorder_published_projects(
  p_ids uuid[],
  p_expected_ids uuid[]
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_ids uuid[];
  v_count integer;
  v_changed integer;
  v_revision bigint;
  v_before jsonb;
begin
  -- The RPC is not exposed to public/regular authenticated clients.
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_user <> 'service_role' then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_ids is null or p_expected_ids is null or cardinality(p_ids) = 0
     or cardinality(p_ids) > 500
     or cardinality(p_ids) <> cardinality(p_expected_ids)
     or cardinality(p_ids) <> (select count(distinct requested.id) from unnest(p_ids) as requested(id))
     or cardinality(p_expected_ids) <> (select count(distinct previous.id) from unnest(p_expected_ids) as previous(id))
     or exists(select 1 from unnest(p_ids) as requested(id) where requested.id is null)
     or exists(select 1 from unnest(p_expected_ids) as previous(id) where previous.id is null) then
    raise exception 'invalid_published_order' using errcode = '22023';
  end if;

  -- Serialise reorders; row locks prevent concurrent changes to published work.
  perform pg_catalog.pg_advisory_xact_lock(11211, 20261116);
  perform 1 from public.projects where status = 'published' for update;
  select array_agg(project.id order by project.position, project.id),
         count(*)::integer
    into v_current_ids, v_count
    from public.projects project
    where project.status = 'published';

  if v_count <> cardinality(p_expected_ids) or v_current_ids is distinct from p_expected_ids then
    raise exception 'portfolio_order_conflict' using errcode = '40001';
  end if;

  -- Compare the exact set of published project UUIDs before any update.
  if exists (
    select requested.id from unnest(p_ids) as requested(id)
    except
    select project.id from public.projects project where project.status = 'published'
  ) or exists (
    select project.id from public.projects project where project.status = 'published'
    except
    select requested.id from unnest(p_ids) as requested(id)
  ) then
    raise exception 'invalid_published_order_scope' using errcode = '22023';
  end if;

  if p_ids = p_expected_ids then
    select published_revision into v_revision
    from public.site_publication_state where singleton_key = 'primary';
    return pg_catalog.jsonb_build_object('count', v_count, 'changed', 0, 'published_revision', v_revision);
  end if;

  select pg_catalog.jsonb_object_agg(project.id::text, to_jsonb(project.*))
    into v_before
    from public.projects project where project.status = 'published';

  with requested as (
    select input.id, (input.ordinality - 1)::integer as new_position
    from unnest(p_ids) with ordinality as input(id, ordinality)
  )
  update public.projects as project
     set position = requested.new_position,
         updated_at = pg_catalog.now()
    from requested
   where project.id = requested.id
     and project.status = 'published'
     and project.position is distinct from requested.new_position;

  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    raise exception 'portfolio_order_not_changed' using errcode = '22023';
  end if;

  update public.site_publication_state
     set published_revision = published_revision + 1, published_at = pg_catalog.now()
   where singleton_key = 'primary'
   returning published_revision into v_revision;

  if v_revision is null then
    raise exception 'publication_state_missing' using errcode = '23514';
  end if;

  -- Store only changed projects, preserving existing revision/history conventions.
  insert into public.content_revisions (
    entity_type, entity_id, action, before_snapshot, after_snapshot,
    note, publish_revision, actor_id
  )
  select 'projects', project.id, 'reorder',
         v_before -> project.id::text, to_jsonb(project.*),
         'Ordem global do portfolio actualizada no Admin',
         v_revision, null::uuid
  from public.projects project
  where project.status = 'published'
    and ((v_before -> project.id::text ->> 'position')::integer
         is distinct from project.position);

  insert into public.admin_audit_log(actor_id, event_type, success, subject, metadata)
  values (
    null, 'content_reorder', true, 'projects',
    pg_catalog.jsonb_build_object(
      'entity_type', 'projects', 'scope', 'published_only',
      'count', v_count, 'changed', v_changed, 'publish_revision', v_revision)
  );

  return pg_catalog.jsonb_build_object(
    'count', v_count, 'changed', v_changed, 'published_revision', v_revision);
end;
$function$;

-- The function runs with invoker rights. Restrict entry to the server's service_role.
revoke all on function public.admin_reorder_published_projects(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.admin_reorder_published_projects(uuid[], uuid[]) to service_role;
