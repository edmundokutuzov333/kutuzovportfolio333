-- Remove original broad policies from private operational tables.
drop policy if exists contact_submissions_admin_all on public.contact_submissions;
drop policy if exists newsletter_subscribers_admin_all on public.newsletter_subscribers;
drop policy if exists newsletter_tokens_admin_all on public.newsletter_tokens;
drop policy if exists content_revisions_admin_all on public.content_revisions;
drop policy if exists admin_audit_log_admin_all on public.admin_audit_log;
drop policy if exists email_outbox_admin_all on public.email_outbox;