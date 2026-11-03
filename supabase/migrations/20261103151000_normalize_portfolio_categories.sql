-- Normalize the existing seed projects to the portfolio taxonomy.
update public.projects
set discipline = 'Campaign design'
where slug = 'diga-yes';

update public.projects
set discipline = 'Social Media',
    challenge = null,
    idea = null,
    outcome = null
where slug in ('jogue-venca-repita', 'datas-que-ligam', 'somos-uma');
