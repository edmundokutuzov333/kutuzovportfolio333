-- Increase lockout duration after repeated lockouts, capped at 60 minutes.
alter table public.admin_auth_attempts
  add column if not exists lockout_level integer not null default 0
  check (lockout_level >= 0);

create or replace function public.register_admin_auth_attempt(p_ip_hash text, p_now timestamptz)
returns table(attempt_count integer, blocked_until timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_count integer; v_blocked_until timestamptz;
begin
  if p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid attempt key'; end if;
  insert into public.admin_auth_attempts as current_attempt
    (ip_hash, attempt_count, window_started_at, last_attempt_at, blocked_until, lockout_level)
  values (p_ip_hash, 1, p_now, p_now, null, 0)
  on conflict (ip_hash) do update set
    attempt_count = case
      when current_attempt.blocked_until > p_now then current_attempt.attempt_count
      when current_attempt.window_started_at <= p_now - interval '15 minutes'
        or current_attempt.window_started_at > p_now then 1
      else current_attempt.attempt_count + 1 end,
    window_started_at = case
      when current_attempt.blocked_until > p_now then current_attempt.window_started_at
      when current_attempt.window_started_at <= p_now - interval '15 minutes'
        or current_attempt.window_started_at > p_now then p_now
      else current_attempt.window_started_at end,
    blocked_until = case
      when current_attempt.blocked_until > p_now then current_attempt.blocked_until
      when current_attempt.window_started_at <= p_now - interval '15 minutes'
        or current_attempt.window_started_at > p_now then null
      when current_attempt.attempt_count + 1 >= 5
        then p_now + make_interval(mins => least(60, 15 * (2 ^ least(current_attempt.lockout_level, 2))))
      else null end,
    lockout_level = case
      when current_attempt.blocked_until > p_now then current_attempt.lockout_level
      when current_attempt.window_started_at <= p_now - interval '15 minutes'
        or current_attempt.window_started_at > p_now then current_attempt.lockout_level
      when current_attempt.attempt_count + 1 >= 5 then current_attempt.lockout_level + 1
      else current_attempt.lockout_level end,
    last_attempt_at = p_now
  returning current_attempt.attempt_count, current_attempt.blocked_until
    into v_count, v_blocked_until;
  return query select v_count, v_blocked_until;
end;
$function$;
revoke all on function public.register_admin_auth_attempt(text, timestamptz) from public, anon, authenticated;
grant execute on function public.register_admin_auth_attempt(text, timestamptz) to service_role;
