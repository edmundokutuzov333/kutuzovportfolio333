# KutuzovPortfolio333

veja esse site: https://www.phantom.land/?utm_source=chatgpt.com
Abra ele de ponta a ponta, cada pagina, veja cada funcionalidade, cada efeito, cada visual, cada identidade etc. Quero um site inspirado no nível de imersão, ritmo visual, animações e navegação da referência, mas com uma identidade original para Edmundo Kutuzov, sem copiar literalmente a marca, o layout, os textos, os projetos ou os efeitos proprietários da Phantom.
em anexo tens a informação que quero no site, é a minha informação, mas deves aumentar mais coisas, ou modificar mais coisas, ali é só uma ideia, tu deves fazer mais, deves te esforçar mais.
Depois eu te entrego as artes oficiais que vão para o site. mas por agora desenhe a base, crie a base, tens tambem em anexo o logotipo meu, que vais usar, traga isso em 3D, com uma apresentação dimensional convincente e alinhada à minha identidade.
quero tambem a parte de logotipos de clientes, em anexo tens os clientes, crie 20 slots animados para clientes, para a parte de clientes.
Tens em anexo também a parte de logotipos de clientes, quero 20 slots

Crie um site de portfólio completo, com várias páginas e uma experiência original inspirada na referência, usando a minha informação e deixando a base preparada para receber as artes oficiais.

crie um plano, que deves executar em 4 fases.
Papel:
És o Engenheiro de Execução Principal deste projecto. Actuas como engenheiro de software sénior, arquitecto, programador, responsável pela qualidade técnica e executor da entrega. O teu objectivo é construir, integrar, testar e entregar software funcional, pronto para produção, e não apenas aconselhar, rever ou fornecer exemplos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kutuzovportfolio333.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/866320a4-978d-403b-b184-3e3fd57d0c19).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Use Bun for reproducible installs. The project pins Bun in `.bun-version` and commits only `bun.lock`.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install --frozen-lockfile
bun run dev
```

## Quality checks

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run assets:inventory
```

Runtime secrets belong in the deployment provider's server-side environment, not in the repository. See `docs/admin-phase-1-baseline.md` for the initial CMS infrastructure and external configuration requirements.

## CMS content migration

The eight public routes read published content from the dedicated Supabase project through the typed loaders under `src/lib/cms/`. The initial import is idempotent, inserts only missing records, and preserves the values in `src/lib/content.ts`:

```sh
SUPABASE_URL="https://your-project-ref.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="set-only-in-your-local-shell-or-secret-manager" \
PUBLIC_SITE_URL="https://kutuzovportfolio333.lovable.app" \
bun run import:cms
```

Never commit the service-role key. The script inserts missing records without overwriting subsequent Admin edits and emits `reports/cms-import-reconciliation.json`. It marks legacy assets as awaiting source access and does not delete or replace any existing image reference. See `docs/cms-phase-2-reconciliation.md` for the observed initial counts and remaining asset/deploy blockers.


## Phase 5 certification checks

The GitHub Actions quality job now runs a read-only contract check against the dedicated Supabase project's public API. It verifies that only published content, visible clients/sections, public settings and approved public media are exposed; private operational tables, private storage and administrative RPCs must reject anonymous access. This job never creates or changes production records.

A separate Playwright job launches the app in CI and exercises every public route plus the unauthenticated Admin gate. The test runner version is pinned separately under `.e2e`; application dependencies continue to install from the committed `bun.lock`. Dependency advisories at high or critical severity block the quality job. The deployment remains a separate operator-controlled step because the Lovable publishing API is not available as a GitHub Actions credential in this repository.
