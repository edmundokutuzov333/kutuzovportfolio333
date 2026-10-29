# Fase 5: testes intensivos, segurança, deploy e certificação

## Gates versionados

- Instalação congelada com Bun 1.3.10 e `bun.lock`.
- Auditoria de dependências com severidade alta/crítica. O pipeline propaga o código de saída da auditoria e, em caso de falha, gera uma proposta de correcção num checkout isolado como artefacto. A proposta não altera o lockfile usado nos testes nem torna o gate verde.
- Typecheck, ESLint, testes unitários, build de produção, secret scanning e inventário de assets.
- Contratos de leitura apenas contra a API pública Supabase: projectos e páginas publicados, drafts, tabelas privadas, RPCs administrativos, CORS e bucket privado. Os testes não criam contactos, subscritores nem ficheiros de teste em produção.
- Job Playwright independente, condicionado pelo job de qualidade, para as oito rotas públicas, o formulário de contacto, o consentimento da newsletter e o gate do Admin em viewport móvel.

## Defeito de permissões descoberto

Em 29 de Outubro de 2026, o contrato anónimo detectou privilégios SQL directos de `anon` e `authenticated` em `content_revisions`, apesar de a política RLS filtrar as linhas. A verificação confirmou que a tabela não continha revisões. A migration desta fase revoga permissões directas do browser e mantém o acesso através das funções de servidor autorizadas. A mesma migration adiciona uma política explícita de negação em `public_form_rate_limits`, cujo uso é exclusivamente server-side.

## Estado de certificação e bloqueios conhecidos

- O login Admin usa o PIN fixo `333` e sessão HMAC server-side; zero utilizadores em Supabase Auth já não bloqueia a entrada. Continuam por certificar sessões expiradas, mutações CRUD após aplicar `20261029120000_admin_pin_only_authorization.sql`, e o smoke test HTTP do deploy Lovable activo.
- Não foi possível confirmar uma cópia de segurança verificada nem um ambiente staging sem custo adicional. Os critérios de backup e validação em staging não podem ser declarados cumpridos.
- `RESEND_API_KEY` e `MAIL_FROM` não foram verificadas. O envio real de email continua por certificar.
- A versão publicada de `public-forms` só será considerada alinhada depois de redeploy a partir do SHA candidato aprovado e confirmação de versão activa.
- O site tem de ser republicado através da integração Lovable depois de a CI do SHA candidato terminar verde; o SHA do GitHub não prova, isoladamente, o conteúdo servido no domínio.
- Os 41 manifestos de assets incluem ficheiros de origem ainda por recuperar; o inventário não equivale a uma certificação de que todas as imagens carregam.

## Política de release

Não certificar o release enquanto houver falhas de auditoria de dependências, testes de contrato, Playwright ou smoke tests no domínio publicado. Os bloqueios de credenciais, backup, E2E autenticado e envio real de email devem permanecer explícitos.
