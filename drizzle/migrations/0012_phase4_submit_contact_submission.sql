create or replace function public.submit_contact_submission(
  p_submission_id uuid,
  p_name text,
  p_email text,
  p_company text,
  p_request_type text,
  p_budget text,
  p_message text,
  p_links jsonb,
  p_attachment_paths jsonb,
  p_source_ip_hash text,
  p_metadata jsonb,
  p_notification_recipient text,
  p_notification_outbox_id uuid,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_submission public.contact_submissions%rowtype;
begin
  if p_submission_id is null
     or nullif(trim(p_name),'') is null or length(trim(p_name)) > 180
     or nullif(trim(p_email),'') is null or length(trim(p_email)) > 320
     or position('@' in trim(p_email)) < 2
     or nullif(trim(p_request_type),'') is null or length(trim(p_request_type)) > 180
     or length(trim(coalesce(p_message,''))) < 10
     or length(trim(p_message)) > 4000 then
    raise exception 'invalid_contact_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 10
     or jsonb_typeof(p_attachment_paths) <> 'array' or jsonb_array_length(p_attachment_paths) > 5
     or jsonb_typeof(p_metadata) <> 'object'
     or p_source_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_contact_payload_shape' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_links) item(value)
    where jsonb_typeof(item.value) <> 'string'
       or item.value #>> '{}' !~ '^https?://[^[:space:]]+$'
  ) then
    raise exception 'invalid_contact_links' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_attachment_paths) item(path)
    where item.path not like p_submission_id::text || '/%'
       or exists (
         select 1 from regexp_split_to_table(item.path, '/') as segment(part)
         where segment.part in ('.','..')
        )
  ) then
    raise exception 'invalid_contact_attachment_path' using errcode = '22023';
  end if;
  if p_notification_recipient is not null and (
    length(trim(p_notification_recipient)) > 320
    or position('@' in trim(p_notification_recipient)) < 2
    or p_notification_outbox_id is null
  ) then
    raise exception 'invalid_notification_recipient' using errcode = '22023';
  end if;

  insert into public.contact_submissions(
    id,name,email,company,request_type,budget,message,links,
    attachment_paths,source_ip_hash,metadata,status,created_at,updated_at
  ) values (
    p_submission_id,trim(p_name),lower(trim(p_email)),nullif(trim(coalesce(p_company,'')),''),
    trim(p_request_type),nullif(trim(coalesce(p_budget,'')),''),trim(p_message),
    p_links,p_attachment_paths,p_source_ip_hash,p_metadata,'new',p_now,p_now
  ) returning * into v_submission;

  if p_notification_recipient is not null then
    insert into public.email_outbox(
      id,message_type,recipient,payload,status,attempts,next_attempt_at,created_at,updated_at
    ) values (
      p_notification_outbox_id,'contact_submission',lower(trim(p_notification_recipient)),
      jsonb_build_object(
        'submission_id',p_submission_id,
        'name',trim(p_name),
        'email',lower(trim(p_email)),
        'company',nullif(trim(coalesce(p_company,'')),''),
        'request_type',trim(p_request_type),
        'budget',nullif(trim(coalesce(p_budget,'')),''),
        'message',trim(p_message),
        'links',p_links,
        'metadata',p_metadata,
        'attachment_count',jsonb_array_length(p_attachment_paths)
      ),
      'pending',0,p_now,p_now,p_now
    );
  end if;

  return jsonb_build_object(
    'submission_id',v_submission.id,
    'status',v_submission.status,
    'notification_outbox_id',case when p_notification_recipient is not null then p_notification_outbox_id else null end
  );
end;
$function$;

revoke all on function public.submit_contact_submission(uuid,text,text,text,text,text,text,jsonb,jsonb,text,jsonb,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.submit_contact_submission(uuid,text,text,text,text,text,text,jsonb,jsonb,text,jsonb,text,uuid,timestamptz) to service_role;