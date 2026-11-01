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

revoke all on function public.admin_mutate_content(text,text,uuid,jsonb,timestamptz,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_mutate_content(text,text,uuid,jsonb,timestamptz,uuid,text) to service_role;

revoke all on function public.admin_reorder_content(text,uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_reorder_content(text,uuid[],uuid,uuid) to service_role;

revoke all on function public.admin_update_contact_submission(uuid,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.admin_update_contact_submission(uuid,text,text,timestamptz,uuid) to service_role;