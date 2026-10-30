-- Throttle records are only accessible to a server-side service role.
drop policy if exists admin_auth_attempts_admin_all on public.admin_auth_attempts;
drop policy if exists admin_auth_attempts_deny_public on public.admin_auth_attempts;
create policy admin_auth_attempts_deny_public on public.admin_auth_attempts for all to anon, authenticated using (false) with check (false);
revoke all on public.admin_auth_attempts from anon, authenticated;
grant all on public.admin_auth_attempts to service_role;