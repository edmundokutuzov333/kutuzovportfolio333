-- KB version must change only when data actually changes, not for empty
-- ON CONFLICT DO UPDATE WHERE ... statements. Additive KB-only trigger adjustment.
drop trigger if exists kb_facts_bump on public.kb_facts;
create trigger kb_facts_bump after insert or update or delete on public.kb_facts
for each row execute function public.kb_bump_version();

drop trigger if exists kb_documents_bump on public.kb_documents;
create trigger kb_documents_bump after insert or update or delete on public.kb_documents
for each row execute function public.kb_bump_version();
