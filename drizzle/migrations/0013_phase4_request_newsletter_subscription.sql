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