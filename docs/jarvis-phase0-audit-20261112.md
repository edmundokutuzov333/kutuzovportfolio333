# JARVIS — auditoria Fase 0 / 12 Nov 2026

- Projecto Supabase confirmado: Portfolio-Kutuzov (`qwjaoheaolpxtciljzvb`), `eu-central-1`. O ID corresponde a `src/lib/cms/public-config.ts`.
- Vercel: `portfoliokutuzov`; função do último deployment verificado em `iad1` (recomendado avaliar região europeia, sujeito às regiões suportadas no plano).
- Conteúdo verificado: 155 projectos publicados (159 no total), cinco serviços publicados e 20 clientes.
- Email oficial: `contact@edmundokutuzov.art` em `profile_content.public_email`.
- Pesquisa por `edmundokutuzov.mz` ou `gmail.com` nas tabelas `profile_content`, `site_settings`, `page_sections`, `pages`, `projects`, `clients`, `services`, `content_revisions`: 0 registos.
- Fluxo antigo do JARVIS: `src/lib/jarvis.functions.ts` usa `createServerFn` POST com `generateContent` do Gemini. A chave `GEMINI_API_KEY` é usada exclusivamente no servidor. Sem Gemini Live; voz com SpeechRecognition / MediaRecorder + transcrição do Gemini, resposta TTS via `speechSynthesis` do navegador. Modelo-base antigo `gemini-3.5-flash-lite` com fallback.
- Bug: o prompt anterior não estabelecia uma fonte canónica para contactos, permitindo alucinação do modelo. A base nova tem `kb_facts` aprovados, mais guardrails a integrar.
- Facebook: duas URLs em conflito, ambas `pending_review`. Não apresentar até aprovação.
- Limites: não há baseline real de TTFB/primeiro token/primeiro áudio nesta auditoria; medir com probes autorizadas após o deploy. Não inventar números de latência.
- Segurança: nunca expor chave de servidor no cliente; nenhuma tabela de conteúdo legada alterada. Migração aditiva em `supabase/migrations/20261112134931_jarvis_knowledge_foundation.sql`.
- Rollback lógico: desactivar `KB_ENABLED`; não apagar tabelas com dados. Para Live opcional usar `JARVIS_LIVE_ENABLED=false`.
