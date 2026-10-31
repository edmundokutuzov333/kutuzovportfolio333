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