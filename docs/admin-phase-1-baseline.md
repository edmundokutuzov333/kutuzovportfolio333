# Kutuzov Admin, Fase 1: baseline e configurações

## Repositório e integridade Git

- Repositório: `edmundokutuzov333/kutuzovportfolio333`
- Branch exclusiva de entrega: `main`
- SHA de base consultado: `1c0508fe1ba0de2d5836209dcd86005318c76193`
- O projecto está ligado à Lovable. Não usar force push, rebase, amend ou squash sobre commits publicados.
- README indica a aplicação publicada em `https://kutuzovportfolio333.lovable.app`. O mecanismo exacto de publicação e a sua relação com gates de CI ainda precisam de confirmação no painel do hosting.

## Baseline de código

- Gestor de pacotes seleccionado: Bun, porque existe `bun.lock` e não foi encontrado `package-lock.json`.
- Versão fixada: Bun 1.3.10, em `.bun-version` e no workflow.
- Scripts originais: `build`, `lint`, `test`, `test:watch`; esta fase adiciona `typecheck` e `assets:inventory`.
- Testes de baseline: `src/test/brief.test.ts` e `src/test/app-routing.test.tsx`.
- O baseline local antes das alterações não pôde ser executado: o ambiente disponível não conseguiu resolver `github.com` para clonar a árvore. Os resultados do GitHub Actions após integração serão registados separadamente e não apresentados como baseline pré-alteração.
- `src/start.ts` já registava `createCsrfMiddleware` para server functions. A alteração mantém esse middleware. As futuras funções administrativas têm de chamar `requireAdmin` no servidor.
- `.gitignore` exclui agora `.env*`, mantendo apenas `.env.example` versionado.

## Supabase

- Projecto: `Portfolio-Kutuzov`
- Project ref: `qwjaoheaolpxtciljzvb`
- Organização: `Kutuzov`
- Região: `eu-central-1` (Frankfurt)
- Estado verificado: `ACTIVE_HEALTHY`
- URL: `https://qwjaoheaolpxtciljzvb.supabase.co`
- PostgreSQL 17.11.
- Custo de criação indicado pelo fornecedor: $0/mês; não garante custo zero de uso futuro ou de serviços externos.
- Migrações aplicadas e versionadas: `20261029064258_admin_foundation_20261029`, `20261029064356_admin_foundation_policy_tuning_20261029`, `20261029064557_admin_auth_attempts_lockdown_20261029`, `20261029064606_admin_private_policy_cleanup_20261029`, `20261029064713_admin_auth_atomic_rate_limit_20261029`, `20261029064935_admin_auth_rate_limit_returning_fix_20261029`, `20261029065016_admin_media_visibility_constraint_20261029`, `20261029065141_admin_auth_progressive_rate_limit_20261029`, `20261029065158_admin_auth_progressive_interval_fix_20261029`.
- Foram criadas 23 tabelas CMS; RLS está activo nas 23, incluindo contactos, subscritores, revisões e throttling.
- Buckets: `portfolio-public-assets` público para imagens aprovadas e `contact-private-attachments` privado para anexos.
- O teste SQL em transacção mostrou que a função anónima consegue ler um projecto publicado e não consegue ler uma submissão de contacto; a transacção foi revertida. O rate limit foi testado com dados sintéticos e esses registos foram eliminados.
- A primeira execução do teste do RPC encontrou dois defeitos no SQL; ambos foram corrigidos por migrações compensatórias e a função devolveu resultados após a correcção. A verificação completa dos tempos de bloqueio progressivo ainda precisa de concluir.
- O advisor de segurança não indicou findings na verificação anterior. O advisor de desempenho indicou índices sem utilização, esperado num esquema ainda sem tráfego. Repetir ambos após a última migração antes de certificar.

## Acesso administrativo e configuração de runtime

A rota `/admin` tem um gate próprio e não monta o Shell público, cursor, Lenis, intro ou cena WebGL. O login exige apenas o código fixo `333`, validado no módulo server-side. A abertura da sessão não depende das credenciais da base de dados. Depois de validado, é criada uma sessão HMAC assinada com a chave server-only do Supabase, guardada num cookie HttpOnly, SameSite=Strict e com expiração. O servidor mantém limitação persistente de tentativas e registo de auditoria sem guardar PINs ou tokens. Não é necessária conta Supabase Auth, email autorizado ou palavra-passe.

O backend administrativo continua a precisar dos segredos de infraestrutura para consultar e alterar dados reais: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor, `PUBLIC_SITE_URL` para validar o canonical, e `RESEND_API_KEY` / `MAIL_FROM` quando estiver activado o envio real de email.

`ADMIN_ACCESS_CODE`, `ADMIN_EMAIL`, `ADMIN_RATE_LIMIT_SALT` e `SUPABASE_PUBLISHABLE_KEY` não são requisitos de login. Não é necessária conta Supabase Auth, email ou palavra-passe. A autenticação mantém validação server-side, cookie HttpOnly assinado e limitação de tentativas local, usando também a tabela persistente quando o Supabase está disponível. O código `333` é fraco e, por ser fixo, não equivale a autenticação forte.

A base Supabase Auth pode continuar sem utilizadores. Para carregar e editar dados reais do CMS continuam a ser necessários `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no runtime do servidor. Se estiverem ausentes, o PIN continua a abrir o espaço Admin e o painel apresenta um erro de configuração de dados, sem confundir esse erro com autenticação.

## CI e deploy

O repositório não tinha workflow de CI confirmado na baseline. `.github/workflows/ci.yml` executa em pushes para `main` e manualmente: secret scan, instalação Bun reproduzível, typecheck, lint, testes, build de produção e inventário de assets, guardando o inventário como artefacto.
O workflow não impede por si só que uma integração de hosting publique imediatamente após um push. As integrações actualmente disponíveis não permitem configurar branch protection/required status checks, secrets do GitHub, secrets de runtime nem o hosting. Não declarar que o deploy está condicionado pela CI até esses controlos serem configurados e verificados.

## Inventário de assets

O script lê recursivamente `src/assets/**/*.asset.json`. O artefacto `reports/assets-inventory.json` regista caminho, asset ID, project ID Lovable, URL relativa e candidata absoluta, chave R2, nome original, tamanho declarado, MIME, data, presença do binário local e SHA-256 quando o binário existir.
Os binários não estão todos versionados no Git. Quando falta o binário, dimensões e hash reais ficam explicitamente desconhecidos. A origem e cada ficheiro têm de ser recuperados e validados antes de alterar referências. Nenhuma imagem é removida ou substituída nesta fase.

## Limitações restantes na Fase 1

- Executar typecheck, lint, testes e build no GitHub Actions depois da integração. A máquina de execução desta sessão não conseguiu clonar GitHub, portanto não houve execução local.
- Configurar autenticação hospedada e convidar a identidade autorizada, sem registo público.
- Adicionar ao hosting os secrets de runtime e confirmar o domínio canónico.
- Configurar regras da branch para exigir checks verdes antes do deploy, se o fornecedor de hosting permitir.
- Verificar que o relatório de inventário de assets é gerado pelo workflow e recuperar as imagens que não têm binários no repositório.
