-- Public KB-only RPC. One round-trip for version + verified public core facts.
create or replace function public.kb_get_core_facts()
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'version', (select s.version from public.kb_state s where s.id=1),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',f.key,'locale',f.locale,'value',f.value,'spoken',f.spoken,
        'priority',f.priority,'visibility',f.visibility,'status',f.status,'source',f.source)
        order by f.priority,f.key)
      from public.kb_facts f
      where f.status='verified' and f.visibility='public'
        and f.key not like '%.candidate.%'
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.kb_get_core_facts() from public,anon,authenticated;
grant execute on function public.kb_get_core_facts() to service_role;