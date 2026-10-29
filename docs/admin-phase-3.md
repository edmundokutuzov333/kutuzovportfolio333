# Kutuzov Admin, Fase 3: interface editorial

## Implementação versionada

A interface autenticada foi ligada a módulos de leitura e edição para páginas suportadas, secções, projectos, clientes, perfil, experiência, métricas, competências, disciplinas, princípios, serviços, processo e definições. A caixa de entrada, histórico, newsletter e biblioteca multimédia são alimentados pelas tabelas reais e apresentam estados vazios/erro; não geram registos de exemplo.

As mutações são expostas como TanStack Start Server Functions. Cada handler exige uma sessão validada por requireAdmin, verifica os dados no servidor e usa credenciais Supabase exclusivamente no módulo server-only. A migração SQL implementa funções SECURITY DEFINER sem acesso por anon/sessão cliente; verifica a identidade de auth.users e o claim app_metadata.site_role=admin, limita os campos modificáveis, valida o token updated_at optimista, cria snapshots e eventos de auditoria, e incrementa a revisão publicada na mesma transacção.

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

Nova migração: supabase/migrations/20261029084600_admin_editorial_mutations_20261029.sql.

A migração é versionada no repositório, mas **não foi aplicada ao Supabase** durante esta execução: só existe um projecto dedicado identificado e não foi disponibilizado um ambiente staging separado para a validação exigida pelo plano. Não se deve executar a migração na base de produção sem validação em staging, backup verificável e revisão das funções SQL. Até ser aplicada, as funções RPC da Fase 3 não existem na base e as mutações vão falhar de forma explícita; a interface não deve ser considerada funcional em produção.

O acesso de produção também depende da configuração hospedada já documentada na Fase 1: identidade de proprietário em Supabase Auth com app_metadata.site_role=admin, variáveis de runtime ADMIN_ACCESS_CODE, ADMIN_EMAIL, ADMIN_RATE_LIMIT_SALT, SUPABASE_URL, chave pública, SUPABASE_SERVICE_ROLE_KEY no servidor e PUBLIC_SITE_URL validada. A aplicação pública lê VITE_PUBLIC_SITE_URL e só emite canonical absoluto quando esta variável contém uma origem HTTPS sem caminho, credenciais, query ou fragmento; configure ambas com a mesma origem canónica real, não com o domínio de preview. Não foram criados segredos, convites ou utilizadores por suposição.

## Testes

src/test/admin-cms-schema.test.ts cobre contratos de payload, slugs, canonical, paths de assets, configurações de secções, campos inesperados e cliente sem logótipo. A execução efectiva do workflow GitHub Actions após o commit, a validação SQL em staging, os testes de permissão/RLS contra a migração nova, E2E com uma identidade autorizada e smoke tests da aplicação publicada são gates de aceitação, não resultados presumidos.
