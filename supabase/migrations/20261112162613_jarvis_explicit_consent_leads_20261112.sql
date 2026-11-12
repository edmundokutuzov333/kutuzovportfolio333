-- JARVIS leads are additive and completely isolated from the existing contact CMS.
create table if not exists public.kb_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(btrim(name)) between 2 and 120),
  contact text not null check (length(btrim(contact)) between 5 and 160),
  brief text not null check (length(btrim(brief)) between 10 and 2000),
  deadline text check (deadline is null or length(deadline)<=100),
  budget text check (budget is null or length(budget)<=100),
  consent_at timestamptz not null default now(),
  source text not null default 'jarvis' check (source='jarvis'),
  status text not null default 'new' check (status in ('new','reviewing','closed'))
);
create index if not exists kb_leads_pending_idx on public.kb_leads (created_at desc) where status='new';
alter table public.kb_leads enable row level security;
revoke all on table public.kb_leads from public, anon, authenticated;
grant select, insert, update, delete on public.kb_leads to service_role;