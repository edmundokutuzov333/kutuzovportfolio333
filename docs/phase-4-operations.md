# Fase 4: media, contactos, newsletter y publicación

## Implementado

- `supabase/functions/public-forms` disponibiliza os endpoints públicos `contact`, `subscribe` e `token`, com validação no servidor, CORS por origem permitida e rate limit persistido no PostgreSQL.
- O contacto é registado em `contact_submissions` antes de devolver confirmação. Os anexos são guardados em `contact-private-attachments`, com caminhos UUID por submissão, validação de bytes PNG/JPEG/WEBP, dimensões, total e tamanho individual. A caixa de entrada solicita links assinados de 120 segundos, após verificar no servidor que o caminho pertence à submissão.
- A newsletter usa estado `pending`, versão de consentimento, tokens aleatórios de uso único, hashes na tabela de tokens, validade e uma fila de email persistida. Uma subscrição só passa a `confirmed` após consumir o token de confirmação. A rota de cancelamento consome um token distinto, marca `unsubscribed` e invalida tokens restantes.
- `email_outbox` guarda falhas recuperáveis. A interface administrativa permite pesquisar a fila e tentar novamente através de uma função de servidor que assina o pedido por HMAC. O payload completo da fila não é enviado ao browser; apenas metadados operacionais são apresentados.
- A biblioteca multimédia permite upload assinado, inspeção server-side dos bytes, validação de assinatura e dimensões, hash SHA-256, metadados, pesquisa, pré-visualização, identificação de referências e remoção bloqueada quando o asset é utilizado. SVG não é aceite sem sanitização.
- Os módulos públicos não tratam uma falha de email como falha da gravação de contacto; uma vez confirmada a submissão na base de dados, o formulário mostra a referência real e o estado operacional da notificação.

## Migrations e dados

Migrations aplicadas ao projecto Supabase existente `qwjaoheaolpxtciljzvb`:

- `20261029083325_admin_editorial_mutations_20261029`: funções transaccionais editoriais e esquema de galeria.
- `20261029083334_admin_site_presentation_settings_20261029`: definições de navegação/rodapé.
- `20261029100000_phase4_public_forms_media_email.sql` (versão Supabase `20261029084727`, nome registado `phase4_public_forms_media_email`): rate limits, submissão persistente de contacto, double opt-in, tokens de uso único e fila de email.
- `20261029101500_phase4_media_acl_tightening.sql` (versão Supabase `20261029091151`, nome registado `phase4_media_acl_tightening`): revoga escrita directa no inventário de media ao browser, deixando as mutações sob funções de servidor autorizadas e verifica que os dois buckets existem com a visibilidade esperada.

A política de custo-zero impediu a criação de staging. As migrations aditivas foram aplicadas ao projecto existente após consultar esquema, migrações, privilégios e políticas. Esta decisão é documentada como desvio do roteiro original. Não foi possível confirmar uma cópia de segurança de fornecedor através das integrações disponíveis.

## Testes observados

- CI em GitHub Actions, para o SHA de origem validado antes desta revisão: secret scanning, instalação reproduzível, TypeScript, ESLint, testes unitários, build e inventário de assets concluídos com sucesso.
- Teste transaccional de SQL com rollback confirmou a criação de uma submissão, criação de newsletter pendente, confirmação por token único, rejeição de reutilização do token, cancelamento e rate limit. O teste foi executado dentro de uma transacção revertida; não ficaram registos de teste.
- O teste de validação de imagem usa um PNG de 1x1 válido, valida CRC/chunks, rejeita imagem truncada e SVG, e exercita o mesmo parser usado pela Edge Function.
- O deployment inicial da Edge Function `public-forms` foi aceite pelo Supabase e ficou `ACTIVE`. A última revisão do código inclui o tratamento de falhas de email após persistência e foi enviada para publicação após o CI. A verificação HTTP POST de ponta a ponta continua não executada, porque as integrações disponíveis não disponibilizam um cliente de requisições HTTP arbitrárias.

## Dependências ainda por confirmar

- A integração Hostinger SMTP está preparada no código, com `smtp.hostinger.com:465` e SSL/TLS. As variáveis `SMTP_USERNAME`, `SMTP_PASSWORD` e `SMTP_FROM` têm de ser introduzidas em Supabase Edge Function Secrets antes de certificar envio no backend. Enquanto SMTP estiver totalmente ausente, Resend permanece apenas como fallback temporário se estiver configurado. A ausência de ambos os fornecedores deixa a fila em falha recuperável e a newsletter pendente. Não existe sucesso de email simulado.
- O login Admin usa agora apenas o PIN fixo `333`; não depende de utilizador Supabase Auth. As mutações exigem a sessão HMAC validada no servidor e a migration `20261029121015_admin_pin_only_authorization.sql` tem de estar aplicada antes de certificar CRUD de produção.
- O domínio público pode continuar a servir a última publicação Lovable até a sincronização/deploy final ser confirmada. O SHA do GitHub não é, por si só, prova de que as alterações estão acessíveis publicamente.
- Não foi possível fazer um POST HTTP de ponta a ponta à Edge Function com as ferramentas de rede disponíveis. A camada SQL foi testada por transacção/rollback e o deployment é verificado separadamente. Contactos com anexos, fluxo de email real e browser E2E devem ser certificados depois da verificação do deploy, dos segredos SMTP Hostinger e de um teste real de contacto e newsletter.

## Segurança e retenção

Os anexos de contacto nunca são guardados em bucket público. Os assets públicos só aceitam PNG, JPG e WEBP verificados. Antes de apagar um asset, o servidor pesquisa referências no conteúdo e bloqueia a operação quando existe utilização ou quando a verificação não pode ser completada. O payload da fila não é exposto ao cliente autenticado. Segredos e tokens em bruto não são registados no log de auditoria.
