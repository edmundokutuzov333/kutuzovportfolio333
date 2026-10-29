-- Phase 4: public form rate limits, durable submissions, double opt-in and recoverable email delivery.
alter table public.contact_submissions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $metadata_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contact_submissions'::regclass
      and conname = 'contact_submissions_metadata_object_check'
  ) then
    alter table public.contact_submissions
      add constraint contact_submissions_metadata_object_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end;
$metadata_constraint$;

create table if not exists public.public_form_rate_limits (
  purpose text not null check (purpose in ('contact','newsletter','newsletter_action')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (purpose, key_hash)
);

create index if not exists public_form_rate_limits_updated_idx
  on public.public_form_rate_limits(updated_at);

alter table public.public_form_rate_limits enable row level security;
revoke all on public.public_form_rate_limits from public, anon, authenticated;
grant all on public.public_form_rate_limits to service_role;

create or replace function public.consume_public_form_rate_limit(
  p_purpose text,
  p_key_hash text,
  p_now timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_limit integer;
begin
  if p_purpose not in ('contact','newsletter','newsletter_action')
     or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_rate_limit_key' using errcode = '22023';
  end if;
  v_limit := case p_purpose when 'contact' then 5 when 'newsletter' then 8 else 20 end;

  insert into public.public_form_rate_limits(
    purpose,key_hash,window_started_at,request_count,updated_at
  ) values (p_purpose,p_key_hash,p_now,1,p_now)
  on conflict (purpose,key_hash) do update
    set window_started_at = case
          when p_now - public.public_form_rate_limits.window_started_at >= interval '15 minutes'
          then p_now
          else public.public_form_rate_limits.window_started_at
        end,
        request_count = case
          when p_now - public.public_form_rate_limits.window_started_at >= interval '15 minutes'
          then 1
          else public.public_form_rate_limits.request_count + 1
        end,
        updated_at = p_now
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$function$;

revoke all on function public.consume_public_form_rate_limit(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.consume_public_form_rate_limit(text,text,timestamptz) to service_role;

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
         select 1 from regexp_split_to_table(item.path, '/') part
         where part in ('.','..')
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

create or replace function public.request_newsletter_subscription(
  p_email text,
  p_consent_text_version text,
  p_confirm_token_hash text,
  p_unsubscribe_token_hash text,
  p_confirm_expires_at timestamptz,
  p_unsubscribe_expires_at timestamptz,
  p_outbox_id uuid,
  p_outbox_payload jsonb,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_subscriber public.newsletter_subscribers%rowtype;
  v_created boolean := false;
begin
  if length(v_email) < 3 or length(v_email) > 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or nullif(trim(p_consent_text_version),'') is null or length(p_consent_text_version) > 100
     or p_confirm_token_hash !~ '^[a-f0-9]{64}$'
     or p_unsubscribe_token_hash !~ '^[a-f0-9]{64}$'
     or p_confirm_expires_at <= p_now
     or p_unsubscribe_expires_at <= p_now
     or p_outbox_id is null
     or jsonb_typeof(p_outbox_payload) <> 'object' then
    raise exception 'invalid_newsletter_payload' using errcode = '22023';
  end if;

  select * into v_subscriber
    from public.newsletter_subscribers
    where email = v_email
    for update;

  if found and v_subscriber.status = 'confirmed' then
    return jsonb_build_object('status','already_confirmed');
  end if;
  if found and v_subscriber.status = 'unsubscribed' then
    return jsonb_build_object('status','unsubscribed');
  end if;

  if not found then
    insert into public.newsletter_subscribers(
      email,status,consent_text_version,requested_at,created_at,updated_at
    ) values (v_email,'pending',trim(p_consent_text_version),p_now,p_now,p_now)
    returning * into v_subscriber;
    v_created := true;
  else
    update public.newsletter_subscribers
      set status='pending',consent_text_version=trim(p_consent_text_version),
          requested_at=p_now,updated_at=p_now
      where id=v_subscriber.id
      returning * into v_subscriber;
    update public.newsletter_tokens set used_at=coalesce(used_at,p_now)
      where subscriber_id=v_subscriber.id and used_at is null;
  end if;

  insert into public.newsletter_tokens(subscriber_id,token_hash,purpose,expires_at,created_at)
    values
      (v_subscriber.id,p_confirm_token_hash,'confirm',p_confirm_expires_at,p_now),
      (v_subscriber.id,p_unsubscribe_token_hash,'unsubscribe',p_unsubscribe_expires_at,p_now);

  insert into public.email_outbox(
    id,message_type,recipient,payload,status,attempts,next_attempt_at,created_at,updated_at
  ) values (
    p_outbox_id,'newsletter_confirmation',v_email,
    p_outbox_payload || jsonb_build_object('subscriber_id',v_subscriber.id),
    'pending',0,p_now,p_now,p_now
  );

  return jsonb_build_object(
    'status',case when v_created then 'created' else 'pending' end,
    'subscriber_id',v_subscriber.id,
    'outbox_id',p_outbox_id
  );
end;
$function$;

revoke all on function public.request_newsletter_subscription(text,text,text,text,timestamptz,timestamptz,uuid,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.request_newsletter_subscription(text,text,text,text,timestamptz,timestamptz,uuid,jsonb,timestamptz) to service_role;

create or replace function public.consume_newsletter_token(
  p_token_hash text,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token public.newsletter_tokens%rowtype;
  v_subscriber public.newsletter_subscribers%rowtype;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok',false,'status','invalid_or_expired');
  end if;
  select * into v_token
    from public.newsletter_tokens
    where token_hash=p_token_hash
    for update;
  if not found or v_token.used_at is not null or v_token.expires_at <= p_now then
    return jsonb_build_object('ok',false,'status','invalid_or_expired');
  end if;

  select * into v_subscriber
    from public.newsletter_subscribers
    where id=v_token.subscriber_id
    for update;
  if not found then
    update public.newsletter_tokens set used_at=p_now where id=v_token.id;
    return jsonb_build_object('ok',false,'status','invalid_or_expired');
  end if;

  if v_token.purpose='confirm' then
    update public.newsletter_tokens set used_at=p_now where id=v_token.id;
    if v_subscriber.status='unsubscribed' then
      return jsonb_build_object('ok',false,'status','unsubscribed');
    end if;
    if v_subscriber.status='confirmed' then
      return jsonb_build_object('ok',true,'status','already_confirmed');
    end if;
    update public.newsletter_subscribers
      set status='confirmed',confirmed_at=p_now,unsubscribed_at=null,updated_at=p_now
      where id=v_subscriber.id and status='pending';
    if not found then
      return jsonb_build_object('ok',false,'status','invalid_or_expired');
    end if;
    return jsonb_build_object('ok',true,'status','confirmed');
  end if;

  if v_token.purpose='unsubscribe' then
    update public.newsletter_tokens set used_at=p_now where id=v_token.id;
    if v_subscriber.status='unsubscribed' then
      return jsonb_build_object('ok',true,'status','already_unsubscribed');
    end if;
    update public.newsletter_subscribers
      set status='unsubscribed',unsubscribed_at=p_now,updated_at=p_now
      where id=v_subscriber.id and status in ('pending','confirmed');
    if not found then
      return jsonb_build_object('ok',false,'status','invalid_or_expired');
    end if;
    update public.newsletter_tokens
      set used_at=coalesce(used_at,p_now)
      where subscriber_id=v_subscriber.id and used_at is null;
    return jsonb_build_object('ok',true,'status','unsubscribed');
  end if;
  return jsonb_build_object('ok',false,'status','invalid_or_expired');
end;
$function$;

revoke all on function public.consume_newsletter_token(text,timestamptz) from public, anon, authenticated;
grant execute on function public.consume_newsletter_token(text,timestamptz) to service_role;

create or replace function public.claim_email_outbox(
  p_outbox_id uuid,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.email_outbox%rowtype;
begin
  update public.email_outbox
    set status='processing',attempts=attempts+1,last_error=null,updated_at=p_now
    where id=p_outbox_id and status in ('pending','failed')
    returning * into v_row;
  if not found then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$function$;

revoke all on function public.claim_email_outbox(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(uuid,timestamptz) to service_role;

revoke all on public.contact_submissions, public.newsletter_subscribers, public.newsletter_tokens,
  public.email_outbox, public.admin_audit_log from public, anon, authenticated;
grant select, insert, update, delete on public.contact_submissions, public.newsletter_subscribers,
  public.newsletter_tokens, public.email_outbox, public.admin_audit_log to service_role;
