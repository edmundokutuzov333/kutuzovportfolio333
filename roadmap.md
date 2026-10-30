# Edmundo Kutuzov — Portfolio roadmap

## Phase 1 — Foundation & identity
- [x] Design system (dark, Deep Abyss blue, Syne / Manrope / JetBrains Mono)
- [x] Content data module (profile, experience, services, clients, process)
- [x] Shell: header, fullscreen menu, footer, custom cursor, smooth scroll, page transitions

## Phase 2 — 3D logo & Home
- [x] EK logo traced to vector, extruded in WebGL with lighting + pointer parallax
- [x] Home: hero, manifesto, capabilities, selected work, clients, CTA

## Phase 3 — Inner pages
- [x] Work index + case study template
- [x] About / Credentials (experience, metrics, skills, principles)
- [x] Services, Process
- [x] Clients: 20 animated slots (marquee + grid)

## Phase 4 — Contact & polish
- [x] 5-step briefing form with validation (budget per currency)
- [x] Newsletter, SEO metadata per page, favicon, tests
- [x] Real works uploaded (4 projects: Diga YES, Gaming, Datas que Ligam, Somos Uma)
- [x] 19 client logos uploaded (Brutal Fruit name-only)
- [x] Iconic intro: «A Fenda Hiperbólica» (3D warp + camera breach)

## Phase 5 — Admin (from EXECUÇÃO_PRIORITÁRIA brief, building here from scratch)
- [ ] Lovable Cloud enabled + ADMIN_CODE secret (333)
- [ ] DB schema: site_content, projects, clients, services, process_steps, contact_requests, newsletter_subscribers, admin_sessions, media_files + RLS + grants + seed from content.ts
- [ ] Storage bucket "media" (public) + policies
- [ ] Admin auth: loginAdmin / getAdminSession / logoutAdmin / requireAdmin (HttpOnly cookie, 12h, rate limit, no Supabase Auth dependency)
- [ ] /admin route: light UI, native cursor, no heavy effects
- [ ] Admin modules: profile/home, projects CRUD, clients CRUD, services/process, contact requests, media library, settings/SEO
- [ ] Public pages read from DB (content.ts becomes seed only)
- [ ] Contact form + newsletter wired to DB
- [ ] Tests: auth flow, CRUD, persistence; browser end-to-end; publish
