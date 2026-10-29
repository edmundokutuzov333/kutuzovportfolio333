# Kutuzov Admin, Fase 3: interface editorial

## Implementação versionada

A interface autenticada foi ligada a módulos de leitura e edição para páginas suportadas, secções, projectos, clientes, perfil, experiência, métricas, competências, disciplinas, princípios, serviços, processo e definições. A caixa de entrada, histórico, newsletter e biblioteca multimédia são alimentados pelas tabelas reais e apresentam estados vazios/erro; não geram registos de exemplo.

As mutações são expostas como TanStack Start Server Functions. Cada handler exige uma sessão de código validada por requireAdmin, verifica os dados no servidor e usa credenciais Supabase exclusivamente no módulo server-only. As funções SQL SECURITY DEFINER continuam indisponíveis para anon e authenticated; aceitam actor nulo apenas em chamadas com role service_role para suportar sessões PIN-only. Mantêm limites de campos, conflito optimista por updated_at, snapshots, auditoria e revisão publicada na mesma transacção.

A acção principal dos formulários é **Guardar e publicar**. O sucesso só é apresentado após uma resposta válida do RPC com o registo e a revisão confirmados. A reordenação usa uma função de servidor dedicada que exige a lista completa de IDs do grupo, valida o âmbito e regista snapshots. Não existe eliminação definitiva nos módulos editoriais.

## Definições de navegação e rodapé

A migração adicional `20261029084900_admin_site_presentation_settings_20261029.sql` introduz valores tipados para a navegação pública, texto do rodapé e rótulos de apresentação. A interface pública lê esses registos depois da publicação e só os aceita se passarem os schemas; caminhos de navegação e do CTA são limitados às rotas implementadas. Se a migração ainda não estiver no ambiente, o site conserva a cópia actual para compatibilidade.

A newsletter pública não apresenta um formulário que finja uma subscrição: o rodapé informa que a confirmação segura por email ainda não está activada. O formulário de contacto também informa que a submissão não é enviada nem guardada e desactiva a acção final até existir o fluxo persistente de contacto da Fase 4. Os links directos de email e WhatsApp continuam disponíveis.

## Funcionalidade de módulos

- **Visão geral:** contagens lidas do CMS, pedidos por tratar, revisões recentes, revisão publicada e estado real dos buckets.
- **Páginas:** edição das oito rotas existentes, idioma, metadados SEO e canonical; não cria rotas que não tenham renderer no router.
- **Secções:** edição da configuração JSON tipada, visibilidade e ordem através de controlos de reordenação operáveis por teclado.
- **Projectos:** CRUD, publicação, destaque, arquivo, capa, galeria e lista de textos alternativos da galeria. Alterar slug publicado actualiza redireccionamentos.
- **Clientes:** CRUD, contexto Home/página de clientes, texto alternativo e opção de exibição textual sem logótipo. O arquivo não elimina associações de projectos.
- **Perfil, experiência, métricas, competências, disciplinas, princípios, serviços e processo:** edição dos campos existentes e ordenação administrável.
- **Definições:** edição dos registos de site_settings existentes sem inventar configurações não consumidas pela apresentação pública. A alteração do canonical é rejeitada quando PUBLIC_SITE_URL não estiver configurada ou não corresponder à origem.
- **Histórico:** consulta de snapshots, autor, data e revisão; restauro cria uma nova entrada, sem apagar o histórico anterior.
- **Caixa de entrada:** consulta de pedidos reais e actualização do estado/notas via RPC. Endpoints de upload/links assinados dos anexos permanecem na Fase 4.
- **Multimédia:** leitura de media_assets, inventário e buckets reais. Upload, sanitização, validação do binário e substituição segura continuam bloqueados até à Fase 4.
- **Newsletter:** consulta dos subscritores reais; confirmação, cancelamento e exportação não são apresentados como operações disponíveis enquanto os tokens e o envio seguro de email não estiverem activados.

Os erros de rede/permissão são apresentados como erros e não como tabelas vazias. A pré-visualização é local; não publica antes da confirmação do servidor. Os campos e mensagens têm labels, os controlos usam foco visível e a reordenação não depende de arrastar com rato.

## Migração e activação

As migrations foram aplicadas ao projecto Supabase dedicado `Portfolio-Kutuzov` (`qwjaoheaolpxtciljzvb`) em produção, usando o projecto já existente e sem criar branches ou recursos pagos. O ambiente de staging não foi criado por decisão explícita de não incorrer em custos; esta é uma divergência documentada ao roteiro original.

Para manter o historial local alinhado com o historial remoto real, os nomes dos ficheiros correspondem agora às versões registadas pelo Supabase:

- `supabase/migrations/20261029083325_admin_editorial_mutations_20261029.sql`
- `supabase/migrations/20261029083334_admin_site_presentation_settings_20261029.sql`

O Supabase confirmou sucesso para ambas. A primeira alteração é aditiva: acrescenta `projects.gallery_alt`, preenche um texto alternativo vazio por imagem legada e impõe correspondência entre o número de imagens e de textos alternativos. Não removeu projectos, galerias, clientes nem páginas. A segunda cria as três definições de apresentação em falta apenas quando a chave ainda não existe.

Verificações directas à base de dados após a aplicação:

- As quatro galerias mantêm os respectivos números de imagens: 6, 2, 7 e 3; os textos alternativos têm a mesma cardinalidade.
- Existem 4 projectos, 20 clientes, 8 páginas, 15 secções, 5 serviços e 4 etapas de processo, sem alterações inesperadas de contagem.
- As três funções RPC editoriais existem. `anon` e `authenticated` não têm permissão de execução; `service_role` tem. O teste de segurança com um actor inexistente foi rejeitado.
- RLS está activo nas 24 tabelas públicas verificadas, sem tabelas com RLS desactivado. O advisor de segurança não devolveu alertas.
- O advisor de desempenho reporta índices ainda não usados, classificados como informativos, esperados num CMS acabado de provisionar; não foram removidos índices.

## Acesso administrativo e limitações de produção

O login de `/admin` usa exclusivamente o código fixo `333`. Não depende de utilizador em `auth.users`, email, palavra-passe ou `app_metadata.site_role`. O cookie de sessão é HttpOnly, SameSite=Strict, tem validade limitada e uma assinatura HMAC calculada no servidor com `SUPABASE_SERVICE_ROLE_KEY`. As tentativas continuam limitadas no PostgreSQL e os eventos são registados sem guardar o PIN.

A ausência de utilizadores em `auth.users` deixou de bloquear o login. A migration `20261029121015_admin_pin_only_authorization.sql` adapta as três funções editoriais para aceitar `p_actor_id = null` apenas quando a chamada chega com role `service_role`; a chamada nunca fica acessível a anon ou authenticated. A migration tem de estar aplicada no ambiente Supabase que serve o site.

O runtime precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para ler e alterar dados reais. São dependências de infraestrutura, não campos adicionais de login, e a chave deve permanecer exclusivamente no servidor. `ADMIN_EMAIL`, `ADMIN_RATE_LIMIT_SALT` e `SUPABASE_PUBLISHABLE_KEY` não são requisitos da autenticação PIN-only. O código fixo `333` é fraco e não deve ser tratado como segredo; mantêm-se rate limit, validação server-side e cookie assinado.

O CRUD positivo de produção e o smoke test HTTP no domínio público só devem ser declarados certificados depois de aplicar/verificar a migration, confirmar os segredos server-side e confirmar o deploy Lovable mais recente.

## Testes

Os testes incluem contratos de payload, slugs, canonical, paths de assets, configurações de secções, campos inesperados, cliente sem logótipo e restauro do snapshot seleccionado. O workflow GitHub Actions do commit de código b3bb201d2cdf7edd0f70b8c8c9600ad20f89d6d4 terminou com sucesso: secret scanning, lockfile, typecheck, lint, testes unitários, build e inventário de assets. A verificação SQL/RLS após as migrations também foi executada directamente na base existente. Os testes positivos de CRUD com uma identidade autorizada e os smoke tests HTTP no domínio público continuam não executados, porque ainda não há qualquer utilizador Auth e a ferramenta de navegação não consegue obter o site Lovable publicado.
