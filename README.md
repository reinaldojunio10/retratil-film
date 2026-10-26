# Retrátil Film — Sistema de Gestão Audiovisual

CRM, funil comercial, propostas (PDF), contratos (PDF), produções, tarefas/agenda, financeiro, equipamentos/locações, WhatsApp (preparado) e relatórios. Next.js + PostgreSQL com RLS.

## Rodar localmente
Requisitos: Node 20+, PostgreSQL 15+ (ou um projeto Supabase).

```bash
npm install
cp .env.example .env           # preencha as conexões
# 1) No Postgres, como superusuário (uma vez):
#    create role retratil login password '...' createrole;  create database retratil owner retratil;
#    create role retratil_app login password '...';
npm run db:migrate             # cria tabelas, RLS, funções e o papel app_runtime
#    grant app_runtime to retratil_app;   (como superusuário)
OWNER_NAME="Seu Nome" OWNER_EMAIL="voce@empresa.com" OWNER_PASSWORD="senha-forte" npm run db:owner
npm run db:demo                # opcional: dados de demonstração marcados como DEMO
npm run dev                    # http://localhost:3000
```

### Supabase (sem precisar de terminal)
1. SQL Editor → cole `db/supabase/1-instalar.sql` → Run (uma única vez).
2. SQL Editor → cole `db/supabase/2-acesso-e-proprietario.sql`, troque os valores `TROQUE_…` → Run.
3. No app (Vercel/.env): `DATABASE_URL=postgresql://retratil_app.<ref-do-projeto>:<senha-do-app>@<host-do-pooler>:6543/postgres` (Connect → *Transaction pooler*) e `DATABASE_SSL=true`.
Atualizações futuras: `npm run db:migrate` com `DATABASE_ADMIN_URL` do usuário `postgres`. Após mudar migrations, regenere o pacote com `npm run db:bundle`.

## Verificações
```bash
npm run lint && npm run typecheck && npm test && npm run build
BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e   # app rodando
```
`npm test` usa `TEST_DATABASE_ADMIN_URL`/`TEST_DATABASE_URL` (bancos terminados em `_test`, que são recriados).

## Variáveis de ambiente
Veja `.env.example`. WhatsApp fica em `WHATSAPP_MODE=disabled` até as credenciais da Meta serem configuradas; `test` apenas simula envios.

Documentação técnica: `docs/AI_CONTEXT.md` · Auditoria: `docs/BUG_AUDIT.md`.
