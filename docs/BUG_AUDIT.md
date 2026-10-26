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
| BUG-009 | Helper do E2E confundia o anunciador de rotas do Next (`role=alert`) com mensagens do app. | Falso negativo no E2E | Seletor restrito às mensagens do app. |

## Pendentes / limitações conhecidas
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
