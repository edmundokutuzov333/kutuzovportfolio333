-- Split public reads from admin write policies and add FK indexes.
do $block$ declare table_name text; begin
  foreach table_name in array array[
    'site_settings','pages','page_sections','profile_content','metrics','experience_items','skills','disciplines',
    'principles','services','process_steps','clients','projects','slug_redirects','site_publication_state','media_assets'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_site_admin())', table_name || '_admin_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin())', table_name || '_admin_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_site_admin())', table_name || '_admin_delete', table_name);
  end loop;
  foreach table_name in array array['contact_submissions','newsletter_subscribers','newsletter_tokens','content_revisions','admin_audit_log','email_outbox'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_site_admin())', table_name || '_admin_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_site_admin())', table_name || '_admin_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin())', table_name || '_admin_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_site_admin())', table_name || '_admin_delete', table_name);
  end loop;
end; $block$;
create policy admin_auth_attempts_deny_public on public.admin_auth_attempts for all to anon, authenticated using (false) with check (false);
create index pages_created_by_idx on public.pages(created_by);
create index pages_updated_by_idx on public.pages(updated_by);
create index page_sections_updated_by_idx on public.page_sections(updated_by);
create index profile_content_updated_by_idx on public.profile_content(updated_by);
create index site_settings_updated_by_idx on public.site_settings(updated_by);
create index clients_created_by_idx on public.clients(created_by);
create index clients_updated_by_idx on public.clients(updated_by);
create index projects_client_id_idx on public.projects(client_id);
create index projects_created_by_idx on public.projects(created_by);
create index projects_updated_by_idx on public.projects(updated_by);
create index slug_redirects_created_by_idx on public.slug_redirects(created_by);
create index media_assets_uploaded_by_idx on public.media_assets(uploaded_by);
create index newsletter_tokens_subscriber_id_idx on public.newsletter_tokens(subscriber_id);
create index content_revisions_actor_id_idx on public.content_revisions(actor_id);
create index admin_audit_log_actor_id_idx on public.admin_audit_log(actor_id);
create index site_publication_state_published_by_idx on public.site_publication_state(published_by);
