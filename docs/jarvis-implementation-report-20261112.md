# JARVIS — Relatório técnico de implementação (12/11/2026)

## Âmbito e fonte auditada

- GitHub: \`edmundokutuzov333/kutuzovportfolio333\`, branch \`main\`.
- Supabase correcto: \`Portfolio-Kutuzov\` — projecto \`qwjaoheaolpxtciljzvb\`, região \`eu-central-1\`, terceira conta ligada.
- Vercel: \`portfoliokutuzov\`, Node 24, funções agora \`fra1\` (Frankfurt).
- CMS: 159 projectos totais, 155 publicados; cinco serviços e 20 clientes publicados.
- Email da base e do site: \`contact@edmundokutuzov.art\`. Busca por \`edmundokutuzov.mz\` ou \`gmail.com\` em oito tabelas CMS, incluindo histórico: zero registos encontrados. O problema original era a geração não orientada por fonte canónica.
- Voz existente: SpeechRecognition (quando disponível), MediaRecorder + transcrição Gemini como alternativa, TTS do navegador. **Não é uma sessão Gemini Live**.

## Fase 0 — auditoria

\`docs/jarvis-phase0-audit-20261112.md\` documenta o fluxo original.
Nunca se encontraram chaves Gemini no bundle público; integração via funções de servidor.
A configuração antiga da Vercel apontava para \`iad1\`, demasiado distante do Supabase Frankfurt.

## Fase 1 — fonte da verdade

Migração \`20261112134931_jarvis_knowledge_foundation.sql\` aplicada à base correcta:
tabelas \`kb_facts\`, \`kb_documents\`, \`kb_chunks\`, \`kb_state\`,
\`kb_query_log\`, \`kb_fact_revisions\`, \`kb_rate_limits\`.
RLS em todas; sem permissões anónimas nem de utilizador geral. Service role exclusiva no servidor.
45 factos aprovados, três por rever; os dois perfis Facebook em conflito nunca são disponibilizados.
\`src/lib/jarvis/facts.ts\` aplica \`buildFactsBlock\`, \`buildCoreProfile\`,
\`getContact\` determinístico e output guardrails (email, telefone, URL).
\`src/lib/jarvis/persona.ts\` define a persona como IA em terceira pessoa.

## Fase 2 — conhecimento

Ingestão aditiva na base de 180 documentos e 180 chunks provenientes do CMS público:
155 projectos, cinco serviços, 20 clientes. Zero embeddings vectoriais existentes.
Todos os 360 ficheiros PT/EN estão versionados em \`knowledge/\`.
Textos ingleses não são tratados como traduções verificadas.
Scripts \`kb:audit\`, \`kb:sync\`, \`kb:ingest\`, \`kb:eval\`
em \`scripts/kb.mjs\`, com hashes e controlo de aprovação.
RPC \`kb_sync_published\` só lê CMS publicado e actualiza o índice.
Teste de idempotência: versões da base \`20 → 20 → 20\` em duas sincronizações.
A sincronização agendada na Vercel executa diariamente às 02:00 UTC,
autenticada por \`CRON_SECRET\`; primeira execução agendada ainda não observada.

## Fase 3 — Gemini e recuperação

\`src/lib/jarvis.functions.ts\`: handlers POST validados.
\`src/lib/server/jarvis-kb.server.ts\`: factos públicos verificados, cache em memória
TTL 60 s e invalidação por \`kb_state.version\`, resposta de contacto sem consulta Gemini,
quota persistente 20/min por bucket de IP e tecto de 300 pedidos/dia.
\`KB_ENABLED=true\` nos ambientes Vercel preview e produção.
Pesquisa lexical FTS com RRF, quatro a seis chunks aprovados no máximo,
e matching por palavras parciais. A geração de embeddings Gemini está implementada
mas **não activada** (\`KB_EMBED_ENABLED=false\` e zero vectores na base).
Sem streaming SSE e sem function-calling do modelo nesta entrega.

## Fase 4 — personalidade

Tom profissional, sem Markdown e com respostas concisas, sem inventar factos ou
fingir ser o Edmundo. Contactos passam por uma fonte canónica e validação
do texto antes de ser apresentado ou pronunciado.
\`src/lib/jarvis/speech.ts\` transforma emails e números de WhatsApp em
pronúncia inteligível para o TTS. O browser continua a usar síntese de voz.

## Fase 5 — administração

\`/admin/knowledge\` protegido com o mesmo \`requireAdmin()\` do site.
Permite rever factos, aprovar/rejeitar, editar, visualizar alertas,
consultar revisões e reverter uma versão anterior;
reindexação dos trabalhos publicados.
Não foi efectuado teste de rollback destrutivo; mudanças são preservadas em histórico.

## Fase 6 — provas e medições

Golden set: \`knowledge/evals/golden.json\`, 145 casos PT/EN.
Vitest verifica contactos oficiais, ambiguidade Facebook, bloqueio de links
e emails não aprovados. CI executa \`bun run test\` e \`bun run kb:eval\`.
Playwright inclui UX da voz/chat, projectos, scroll e endpoints de manutenção protegidos.

Medições **da função SQL apenas**, não ponta a ponta:
- \`Toyota\`: 30 amostras, p50 1,07 ms, p95 1,30 ms.
- \`Diga YES\`: 30 amostras, p50 1,11 ms, p95 1,29 ms (pico 50,86 ms).
- \`/api/jarvis/health\`: HTTP 200 com 45 factos aprovados;
  processamento interno observado de 335–350 ms frio e 0–1 ms quente.

**Não medidos**: TTFT Gemini real, primeiro áudio, p50/p95 com rede e modelo,
consumo e quota real, precisão da transcrição por navegador. Não afirmar metas
de latência globais até recolher amostras reais por modalidade.

## Fase 7 — publicação e rollback

Vercel Git integration publica commits de \`main\`.
Produção usa \`fra1\`; \`KB_ENABLED=true\` em produção e preview.
\`JARVIS_LIVE_ENABLED\` fica desactivado por omissão.
Existe um endpoint de emissão de token Live efémero, mas **não há ainda
cliente Gemini Live nem validação de voz Live ponta a ponta**.
\`KB_ENABLED=false\` desactiva a recuperação sem apagar a base;
requires alteração de env + novo deploy. Não há prova de exercício de rollback
com o site público durante esta execução.

## Definition of Done (estado verificável)

- [x] Projecto Supabase correcto identificado e ligado.
- [x] Email canónico na BD e zero ocorrências do email falso nas tabelas auditadas.
- [x] \`getContact\` determinístico e output guardrails de texto/TTS.
- [x] Base \`kb_*\` aditiva, RLS segura e 45 factos aprovados.
- [x] 180 documentos indexados com pesquisa lexical e RPC RRF.
- [x] 145 golden cases PT/EN com testes determinísticos e gate CI.
- [x] Admin protegido e histórico com reposição editorial.
- [x] Cron nocturno configurado, autenticação por segredo no servidor.
- [x] Função regionalizada em Frankfurt e endpoint de saúde pronto.
- [ ] Embeddings dos 180 documentos gerados e pesquisa semântica avaliada.
- [ ] Streaming SSE e function calling do modelo.
- [ ] Live áudio de ponta a ponta com transcrição bidireccional e barge-in.
- [ ] Consentimento e \`submit_lead\` via ferramenta autenticada.
- [ ] Golden set com Gemini real PT/EN e smoke de voz em browser físico.
- [ ] Benchmarks p50/p95 totais de voz e texto.
- [ ] Rollback exercitado em produção e reindex nocturno observado.
- [ ] Facebook: dono aprova uma única URL oficial.

**Nota de segurança**: Nunca publicar chaves Gemini, Supabase ou CRON_SECRET.
Não foi efectuado scraping de Google, LinkedIn, Instagram ou Facebook.
