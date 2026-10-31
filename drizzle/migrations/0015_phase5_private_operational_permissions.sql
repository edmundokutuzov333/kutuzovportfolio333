-- Phase 5: deny direct browser access to private revision data.
-- Admin server functions use service_role after requireAdmin(); the browser does not need
-- direct SELECT/INSERT/UPDATE/DELETE privileges on historical snapshots.
revoke all privileges on table public.content_revisions from public, anon, authenticated;
grant all privileges on table public.content_revisions to service_role;

-- Rate-limit state is server-managed only. SECURITY DEFINER functions and service-role
-- handlers operate on it; the browser roles receive an explicit deny policy.
drop policy if exists public_form_rate_limits_deny_client on public.public_form_rate_limits;
create policy public_form_rate_limits_deny_client
  on public.public_form_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.public_form_rate_limits is
  'Server-only rate-limit state; browser roles are denied by grants and RLS.';
comment on table public.content_revisions is
  'Private publication history; read and write only via authenticated server functions using service_role.';