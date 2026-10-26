# BUG_AUDIT — Retrátil Film

## Corrigidos
| ID | Problema | Como foi detectado | Correção |
|----|----------|--------------------|----------|
| BUG-001 | `app_whatsapp_ingest` falhava com "column reference phone is ambiguous" ao receber mensagem (variável PL/pgSQL com mesmo nome da coluna). | Teste de integração | Migration `0006_fix_whatsapp_ingest.sql` (variável `v_phone`, colunas qualificadas). |
| BUG-002 | Formulários perdiam todos os valores digitados após erro de validação (reset automático do React 19 em `<form action>`). | Teste manual com Playwright | `EntityForm` passou a usar `onSubmit` + `startTransition` (sem reset). |
| BUG-003 | Envio de WhatsApp fora da janela de 24h descartava o rascunho junto com o erro (rollback). | Teste E2E | Rascunho é mantido e o motivo é informado. |
| BUG-004 | PDF da proposta com colunas "Valor unit."/"Total" e rótulo "Total" sobrepostos. | Inspeção visual do PDF | Ajuste das posições das colunas em `src/lib/pdf.ts`. |
| BUG-005 | Regex `{1,512}` inválida no Postgres (limite 255) impedia a migration de dados base. | Execução das migrations | Check substituído por `^[a-z0-9_]+$` + `length <= 512`. |
| BUG-006 | Índice único com `created_at::date` (não imutável) em `whatsapp_messages`. | Revisão antes da execução | Uso de `(created_at at time zone 'UTC')::date`. |
| BUG-007 | Consulta da agenda usava `UNION` com `t.*` e colunas incompatíveis. | Revisão de código | Colunas explícitas nos dois lados. |
| BUG-008 | Exportar `serviceFields` de `page.tsx` quebraria o build do Next. | Revisão | Movido para `servicos/fields.ts`. |
| BUG-010 | No Supabase, funções criadas após a revogação inicial ficavam executáveis pelos papéis públicos `anon`/`authenticated` (Data API), permitindo chamar automações e injetar mensagens de webhook. | Revisão de segurança para o Supabase | Migration `0007_supabase_hardening.sql` revoga e bloqueia concessões futuras; validado em banco simulado. |
| BUG-011 | Classes `.input`/`.btn` fora de `@layer` venciam utilitários do Tailwind (ex.: `sm:w-80`), deixando filtros sempre em largura total. | Captura no tablet | Classes movidas para `@layer components`. |
| BUG-012 | Painel inicial e tela de WhatsApp mais largos que a tela no celular (itens de grade sem `min-w-0`, URL/variáveis sem quebra); o navegador reduzia o zoom e toques na barra inferior caíam no lugar errado. | Teste E2E do PWA (Pixel 7) | `Card` com `min-w-0`; `break-all` nos códigos longos. |
| BUG-013 | Tabelas com rolagem lateral no celular, tablet e notebook de 1024px; campos com fonte < 16px (zoom no iPhone); alvos de toque < 40px. | Auditoria responsiva (150 ocorrências antes) | Tabelas viram cartões < 1280px, fonte 16px e alvos ≥ 44px no celular. |
| BUG-014 | A auditoria responsiva comparava com `innerWidth`, que "estica" em emulação móvel e escondia estouros de largura. | Investigação do BUG-012 | Comparação com a largura real do aparelho. |
| BUG-009 | Helper do E2E confundia o anunciador de rotas do Next (`role=alert`) com mensagens do app. | Falso negativo no E2E | Seletor restrito às mensagens do app. |

## Pendentes / limitações conhecidas
- **Testes em aparelhos reais não realizados**: celular/tablet testados por emulação no Chromium (Playwright). Safari/WebKit real (iPhone) não estava disponível no ambiente; validar instalação do PWA e layout em iPhone e Android físicos.
- Um erro de hidratação do React (#418) apareceu uma única vez em `/equipamentos/reservas` durante a auditoria e não se repetiu em 4 execuções seguintes; acompanhar.
- O workflow `.github/workflows/deno.yml` (adicionado no GitHub) roda `deno lint/test`, que não se aplica a este projeto Node/Next.js e deve falhar; substituir por um workflow Node (`npm ci && npm run lint && npm run typecheck && npm run build`).
- **Credenciais externas**: WhatsApp Business Platform (token, phone number id, verify token, app secret) não configuradas; envio real nunca foi testado contra a Meta.
- **Assinatura digital** de contratos não integrada (há apenas registro manual de assinatura).
- **Arquivos de projeto**: guardados como links (Drive/Dropbox/Frame.io). Upload para Supabase Storage não implementado.
- **Conflito de reservas**: a checagem soma todas as reservas que se sobrepõem ao período pedido (conservadora: pode bloquear um caso raro em que duas reservas sobrepostas ao período não se sobrepõem entre si).
- **Rate limit** de login é por conta (bloqueio após 5 tentativas); não há limite por IP.
- **CSP** (Content-Security-Policy) não configurada; demais cabeçalhos de segurança estão ativos.
- Funil sem arrastar-e-soltar (mudança de etapa por botões).
- Relatórios sem exportação (CSV/PDF).
- E2E cria registros "E2E …" no banco onde roda; usar um banco de homologação.
- Deploy de produção não realizado (aguarda autorização e credenciais de banco/hosting).
