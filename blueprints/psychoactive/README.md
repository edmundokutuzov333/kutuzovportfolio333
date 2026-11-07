# Implementação de referência

Código original produzido a partir da observação de caixa preta. O conteúdo publicado vem do CMS existente do portefólio; a auditoria usa um mock assinalado. Não contém fontes, vídeos, logótipos ou código descarregado da Psychoactive.

Esta aplicação permite verificar componentes e contratos. Não certifica equivalência visual integral nem substitui a aplicação TanStack Start existente. Usa React, TanStack Router, Framer Motion e Lenis já presentes no repositório; reutiliza diretamente os loaders, validadores e resolvedores de recursos existentes.

## Execução remota

O workflow [Replica reference](../../.github/workflows/replica-reference.yml) instala o lockfile existente, executa testes de fronteira e de navegador, compila e tenta publicar no GitHub Pages. Não precisa do agente Lovable nem de uma instalação local.

O GitHub Pages tem de poder ser ativado para o repositório. Se o token de Actions não tiver essa capacidade, a etapa de configuração falha explicitamente. Nesse caso, ativar **Settings → Pages → Source: GitHub Actions** e repetir o workflow. A publicação do portefólio SSR noutro fornecedor é independente.

## Dados e limitações

- A origem pública configurada no repositório é `qwjaoheaolpxtciljzvb.supabase.co`.
- `supabase/config.toml` aponta para outro identificador. Não executar migrações a partir desse ficheiro sem reconciliar a associação.
- Os caminhos relativos antigos de imagens são resolvidos para a origem de produção existente; os novos objetos vêm de `portfolio-public-assets`.
- Existem imagens antigas que falham a verificação da CI. O componente reserva o espaço e apresenta um fallback.
- A demonstração usa URLs com `#` para suportar Pages. A aplicação final deve usar as rotas SSR TanStack Start documentadas no blueprint.
- As fontes do original não foram copiadas. Arial e Courier New são substitutos; equivalência tipográfica é UNKNOWN.
- Conteúdo editorial, prémios e testemunhos do titular não existem nos contratos CMS examinados. Os artigos são exemplos originais e os restantes espaços não inventam provas.
- O formulário de contacto simula por omissão. A opção explícita de envio utiliza o serviço real já existente do portefólio. Não foi efetuado qualquer envio real durante os testes.
- O URL copiado pelo mock serve como exemplo de partilha; não identifica um relatório persistido no servidor.

Consultar [CLONE_SPEC.md](../../CLONE_SPEC.md) e [FULL_REPLICA_SPEC_AND_BLUEPRINT.md](../../FULL_REPLICA_SPEC_AND_BLUEPRINT.md).
