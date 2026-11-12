-- Single DB round-trip for per-IP and global daily JARVIS quotas.
-- This only changes the new kb_* function and adds a new function.
create or replace function public.kb_acquire_rate_slot(p_bucket text,p_max integer default 25,p_window_seconds integer default 60)
returns boolean language plpgsql security invoker
set search_path=public as $$
declare n integer;
begin
  if length(coalesce(p_bucket,''))<20 or p_max<1 or p_max>1000 or p_window_seconds<30
     or p_window_seconds>86400 then return false; end if;
  insert into public.kb_rate_limits(bucket,window_start,requests,updated_at)
  values(p_bucket,now(),1,now())
  on conflict(bucket) do update
  set requests=case when kb_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else kb_rate_limits.requests+1 end,
      window_start=case when kb_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else kb_rate_limits.window_start end,
      updated_at=now()
  returning requests into n;
  return n<=p_max;
end $$;

create or replace function public.kb_acquire_quotas(p_bucket text,p_daily integer default 300)
returns boolean language plpgsql security invoker
set search_path=public as $$
begin
  if not public.kb_acquire_rate_slot('ip:'||p_bucket,20,60) then return false; end if;
  return public.kb_acquire_rate_slot('daily:global:'||to_char(now() at time zone 'utc','YYYY-MM-DD'),p_daily,86400);
end $$;

revoke all on function public.kb_acquire_quotas(text,integer) from public,anon,authenticated;
grant execute on function public.kb_acquire_quotas(text,integer) to service_role;
