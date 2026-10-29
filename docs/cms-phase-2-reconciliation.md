# Fase 2: reconciliação da migração CMS

## Estado verificado

- Conteúdo importado na base de dados dedicada `Portfolio-Kutuzov` através de uma migração SQL idempotente, sem apagar imagens, registos anteriores ou histórico.
- Páginas: 8 (Home, Work, detalhe de caso, About, Services, Process, Clients, Contact).
- Secções: 15 no total, incluindo 7 secções visíveis da Home, com posições 0 a 6.
- Projectos: 4 publicados, na ordem original e todos destacados, com slugs, marcas, anos, textos, tonalidades e galerias preservados.
- Clientes: 20, incluindo `Brutal Fruit` sem logótipo, apresentado por texto.
- Métricas: 5.
- Experiência: 5.
- Competências: 5.
- Grupos de disciplinas: 3, com 15 itens.
- Serviços: 5.
- Princípios: 4.
- Etapas do processo: 4.
- Definições públicas: 4 (capabilities, project_types, budgets, contact_steps).
- Manifestos de assets inventariados: 41. Todos estão marcados `pending_source_access`; não houve cópia para o novo bucket porque os binários não estão no Git e não foi possível verificar o acesso aos objectos de origem.

## Política de assets

As URLs originais do serviço de assets Lovable foram preservadas nos registos dos logótipos e projectos. Os manifestos mantêm os tamanhos e MIME declarados, mas as dimensões, o MIME real e o SHA-256 não foram preenchidos porque o binário original ainda não foi recuperado. Não se deve eliminar ou substituir qualquer URL anterior até descarregar, validar o conteúdo real, calcular hash e dimensões e confirmar que o novo objecto é acessível.

## Fonte de verdade e actualização

As oito rotas públicas agora têm loaders que consultam a REST API do Supabase, e os arrays de `src/lib/content.ts` ficam reservados ao importador e testes de paridade. As queries usam `cache: no-store`, filtram conteúdos publicados e validam respostas com Zod. A Home usa `page_sections` para ordem e visibilidade e apenas aceita tipos React suportados. O Shell público consulta `site_publication_state` a cada 3 segundos e invalida as rotas quando a revisão muda.

## Critérios que continuam bloqueados

1. Os binários das 41 imagens ainda precisam de ser recuperados e verificados. A referência existente não foi removida; a migração de armazenamento não está concluída.
2. A publicação do commit no domínio público e o smoke test real ainda dependem do mecanismo de deploy, que deve ser confirmado sem contornar a CI.
3. O formulário de contacto e a newsletter ainda apresentam o comportamento antigo de confirmação visual. A persistência real é tratada na Fase 4, conforme o plano.
