# Edmundo Kutuzov | Portfolio

> A bilingual, media-rich portfolio for art direction, campaign design, social content, visual systems and digital experiences.

[![Production](https://img.shields.io/badge/production-edmundokutuzov.art-111827?style=for-the-badge)](https://edmundokutuzov.art)
[![Lovable sync](https://img.shields.io/badge/Lovable-synchronised-8b5cf6?style=for-the-badge)](https://lovable.dev)
[![Tests](https://img.shields.io/badge/tests-65%20passing-16a34a?style=for-the-badge)](#quality-gates)

## Product in one sentence

The site presents Edmundo Kutuzov's selected work as a visual archive with original-size imagery, motion, editorial case studies, client proof, a bilingual interface and a protected editorial admin.

## Live surface

| Surface | URL | Purpose |
| --- | --- | --- |
| Public portfolio | [edmundokutuzov.art](https://edmundokutuzov.art) | Published experience |
| Work index | [/work](https://edmundokutuzov.art/work) | Filterable portfolio archive |
| Clients | [/clients](https://edmundokutuzov.art/clients) | Client logo system |
| Contact | [/contact](https://edmundokutuzov.art/contact) | Structured project enquiry |
| Admin | [/admin](https://edmundokutuzov.art/admin) | Editorial management |

## Experience principles

- The work leads. Metadata supports it.
- Original media proportions are preserved. Published images and videos are never forced into a decorative crop.
- English is the primary language. Portuguese (Portugal) is available through the visible EN / PT switcher.
- Motion adds hierarchy, not noise. Reduced-motion preferences are respected.
- Every public media asset has an accessible alternative or a deliberate fallback.
- The editorial workflow stays simple: create, upload, reorder, feature, preview, publish.

## Architecture

```text
TanStack Start + React 19
        |
        +-- File routes: src/routes
        +-- Design system: src/styles.css + src/components
        +-- i18n: src/lib/i18n.tsx
        +-- CMS loaders: src/lib/cms/loaders.ts
        +-- Public Supabase data and media URLs
        +-- Server-only admin mutations and media handling
        +-- Vercel production deployment
```

### Repository map

```text
src/
  components/        Shared shell, cards, clients, motion and admin UI
  lib/cms/            Schemas, queries, loaders and published content types
  lib/server/         Server-only admin auth, CMS and media operations
  lib/i18n.tsx        EN / PT-PT language state and content translations
  routes/             Home, work, case studies, about, services, process, clients, contact, admin
  test/               Unit and integration-oriented regression tests
public/
  client-logos/      Curated client marks supplied for the portfolio
  favicon.png
  edmundo-kutuzov-cv-2026.pdf
```

## Public experience

### Home

The Home route is composed from published CMS sections: hero, manifesto, selected work, services, metrics, clients and principles. The selected-work fan is generated from unique project slugs, preferring each project's cover artwork so the same project is not repeated in the visible sequence.

### Work and case studies

Projects carry a cover, optional gallery, client, year, discipline, challenge, idea, outcome, status, feature state and editorial position. Artwork is rendered with natural height and width. Galleries align to the top and detect video sources by media type and extension.

### Client system

The 20 supplied client marks are mapped by CMS slug to deterministic files in `public/client-logos/`. This keeps brand placement independent of upload ordering and ensures every existing client record has a matching visual mark:

`Absa`, `Toyota Moçambique`, `Nissan Moçambique`, `Hyundai Moçambique`, `Galp`, `TotalEnergies`, `Vodacom`, `Ronil Auto Moçambique`, `Pernod Ricard Moçambique`, `GIZ`, `MultiChoice`, `KitKat`, `Flying Fish`, `Brutal Fruit`, `Joaquim Chaves Saúde`, `Ponta Apart Hotel`, `Hotel Cardoso`, `EMOSE`, `Moçambique Companhia de Seguros` and `PROMAR`.

The client grid uses a restrained reveal, grayscale-to-colour transition, scale cue and keyboard focus state. The marquee intentionally repeats its source row to create a continuous loop; the editorial project fan uses deduplication instead.

### Contact

The contact page uses a structured brief rather than an unbounded blog-style form. Contact cards use Lucide outline icons with consistent stroke weight, a responsive phone scale and deliberate line wrapping so phone, email and call actions stay legible on small screens.

## Editorial admin

The admin is designed around the portfolio use case:

1. Project information: name, client, year, category and role.
2. Presentation: challenge, idea and outcome.
3. Media: multi-file upload, original quality, preview, alt text, drag-and-drop ordering and individual removal.
4. Publication: featured state, draft or published state, draft save and publish.

The project workspace is a visual grid with media previews, position controls, feature toggles, edit / preview actions, archive controls and revision history. Mutations are server-side and audited. The browser only receives the public Supabase configuration; privileged credentials remain server-only.

## Data and media

- Supabase stores published CMS records, editorial state, revisions and public asset metadata.
- Public asset resolution accepts absolute URLs, legacy published paths and safe object paths.
- Private contact attachments are kept separate from public portfolio media.
- The browser-safe Supabase URL and publishable key are read from `src/lib/cms/public-config.ts`. Do not commit service-role keys, storage application keys or SMTP credentials.
- Client logos in this release are versioned with the frontend so the supplied marks are available immediately and render consistently in the public experience.

## Internationalisation

The `I18nProvider` keeps the server render deterministic, then restores the saved language preference after hydration. This avoids a language preference causing a React hydration mismatch. The Home hero headline, role line, location, manifesto, navigation labels and CMS section copy all pass through the translation layer. Use `tx()` for CMS or content strings and `t()` for stable interface keys.

## Local development

Requirements: Node.js 20+, pnpm and access to the project environment variables.

```bash
pnpm install
pnpm dev
pnpm build
pnpm vitest run --pool=forks --maxWorkers=1
```

The production build is generated by TanStack Start and Nitro. Keep server-only variables out of client modules. Never use a service-role credential in `VITE_*` or any file imported by a browser route.

## Quality gates

The release gate is:

- `pnpm vitest run --pool=forks --maxWorkers=1` with all tests passing.
- `pnpm build` completing successfully.
- Browser smoke checks for `/`, `/work`, `/about`, `/services`, `/process`, `/clients`, `/contact` and `/admin`.
- EN and PT checks on Home, including the headline and manifesto after a language switch.
- Public-domain verification after deployment, not only repository or CI verification.

## Deployment and Lovable synchronisation

This repository is connected to Lovable. Published changes must be fast-forward commits on `main`. Do not force-push, rebase, amend or squash commits already published. After a GitHub API commit lands on `main`, trigger the configured Vercel deployment and verify the real domain. Lovable then receives the same branch history and can continue editing from the published state.

## Design and accessibility notes

- Syne is used for display hierarchy, Manrope for reading text and JetBrains Mono for labels and editorial metadata.
- Interactive controls expose focus states and pressed state where appropriate.
- Media includes alt text or an explicit fallback label.
- `prefers-reduced-motion` disables the marquee animation.
- Touch layouts avoid relying on hover alone for essential information.
- Icons are used as supporting affordances and never replace the label of a critical action.

## Content workflow

For a new project, choose the correct category and cover, add the original media, write concise editorial context, check the visual order in preview, set the position and feature state, save a draft, then publish. Keep filenames descriptive and alt text specific to what the image contributes to the case study.

## License and ownership

This is a private portfolio application. Artwork, client marks, copy and media remain the property of their respective owners and must not be reused outside the authorised project context.
