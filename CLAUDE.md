# Retrátil Film

Este repositório tem duas frentes. Identifique em qual a tarefa se encaixa antes de agir.

## 1. Sistema de gestão (CRM) — padrão
Aplicação Next.js + PostgreSQL com RLS: `src/`, `db/`, `tests/`, `scripts/`, `public/`.
Contexto técnico em `docs/AI_CONTEXT.md`; auditoria em `docs/BUG_AUDIT.md`.
Antes de concluir alterações: `npm run lint && npm run typecheck && npm test`.

## 2. Estúdio de visuais para shows
Tudo em `estudio-visuais/`. Quando a tarefa for sobre visuais de palco, telões/LED, logos animados, loops ou cue sheets, leia e siga `estudio-visuais/CLAUDE.md` e use a skill `show-visuals-production` e os subagentes em `.claude/agents/`.
As regras do estúdio não se aplicam ao código do CRM, e o trabalho do estúdio não deve alterar o CRM.

## Regra geral
Não gastar créditos, usar APIs ou serviços pagos, instalar software nem enviar material privado a serviços externos sem aprovação explícita do usuário.
