# AI_CONTEXT — Retrátil Film (Sistema de Gestão Audiovisual)

Contexto técnico para retomar o trabalho sem reler o projeto inteiro.

## Stack
- Next.js 15.5 (App Router, Server Components + Server Actions), React 19.1, TypeScript 5.9, Tailwind 4, Zod 4.
- PostgreSQL 15+ via `pg` (compatível com Supabase Postgres). PDFs com `pdf-lib`. Ícones `lucide-react`.
- Testes: Vitest (unit + integração com Postgres real) e Playwright (script `tests/e2e/smoke.mjs`).

## Decisões de arquitetura
- **Autenticação própria no banco** (não Supabase Auth): `users` + `user_credentials` (bcrypt via pgcrypto) + `sessions` (token aleatório no cookie httpOnly `rf_session`; no banco só o SHA-256). Funções `SECURITY DEFINER`: `app_login`, `app_session_user`, `app_logout`, `app_set_password` (só owner), `app_change_password`. Bloqueio de 15 min após 5 senhas erradas.
- **RLS real**: o app conecta com um papel membro de `app_runtime` (não é dono das tabelas). Cada requisição roda numa transação com `set_config('app.session', sha256(token), true)`. `app_user_id()` só resolve se a sessão existir, não estiver expirada e o usuário estiver ativo. Políticas usam `app_can(modulo, escrita)` lendo `role_permissions` (owner = tudo). Ocultar botões é só UX; o banco bloqueia.
- **Exclusão controlada**: sem DELETE em clientes, lançamentos, usuários, auditoria (arquivar/cancelar/desativar). Propostas/contratos só excluem em rascunho.
- **Regras no banco (fonte da verdade)**: totais de proposta (triggers), conflito de reserva de equipamentos (trigger com lock), datas de fechamento/conclusão, ao menos 1 owner ativo, auditoria genérica (`audit_log`) com autor.
- `src/lib/calc.ts` espelha cálculos para UI/testes.
- **WhatsApp**: `WHATSAPP_MODE` = `disabled` (padrão) | `test` (só simula) | `live` (Cloud API; rebaixa para disabled se faltar credencial). Webhook valida `X-Hub-Signature-256`; processamento em `app_whatsapp_ingest` (SQL). Automações (`app_run_automations`) criam **rascunhos + tarefas**, nunca enviam. Regra das 24h aplicada no envio.
- Fuso: America/Sao_Paulo (`TZ_OFFSET -03:00` em `src/lib/format.ts`). Datas `date` trafegam como string `YYYY-MM-DD`.

## Estrutura
- `db/migrations/*.sql` — aplicadas em ordem por `scripts/migrate.ts` (tabela `schema_migrations`). Nunca editar migration já aplicada em produção: criar nova.
- `src/lib/` — `db.ts` (pool + `withSession`), `auth.ts` (`getSession`, `requireUser`, `tx`), `actions.ts` (`runForm`/`runButton`: permissão + erros + toast), `validation.ts` (schemas Zod), `permissions.ts`, `labels.ts`, `pdf.ts`, `whatsapp.ts`, `lookups.ts`.
- `src/components/` — `ui.tsx` (server), `form.tsx` (`EntityForm` dirigido por config de campos; submit manual para não perder dados no erro), `shell.tsx` (menu/toast), `history.tsx`.
- `src/app/(app)/<modulo>/` — `page.tsx`, `novo|nova/`, `[id]/`, `actions.ts`, `fields.ts`.
- APIs: `/api/propostas/[id]/pdf`, `/api/contratos/[id]/pdf`, `/api/whatsapp/webhook`, `/api/cron/automacoes` (Bearer `CRON_SECRET`), `/api/health`.

## Módulos (chave de permissão)
dashboard, clientes, funil, servicos, propostas, contratos, projetos, tarefas, financeiro, equipamentos, whatsapp, relatorios, usuarios, configuracoes.

## Ambiente local usado no desenvolvimento
- Postgres 16 local: bancos `retratil` e `retratil_test`; papéis `retratil` (dono/migrations, CREATEROLE) e `retratil_app` (runtime, `grant app_runtime`).
- Owner de teste: `dono@retratil.test` (senha gerada localmente, fora do repositório).
- Dados DEMO: `npm run db:demo` / `npm run db:demo -- --remove`.

## Mobile e PWA
- Layout: menu lateral fixo ≥ 1024px; abaixo disso, cabeçalho + gaveta (Esc fecha, trava rolagem) + barra inferior com 4 atalhos (por permissão) + "Mais". Áreas seguras via `env(safe-area-inset-*)` (`pt-safe`/`pb-safe`).
- `Table` (ui.tsx) injeta `data-label` em cada célula; CSS `.rtable` vira cartões abaixo de 1280px. Classes `.input/.btn/...` ficam em `@layer components` para utilitários do Tailwind poderem sobrescrever.
- Toque: alvos ≥ 44px e campos com 16px no celular (evita zoom do iOS). `Card` tem `min-w-0` (itens de grade não estouram a largura).
- PWA: `src/app/manifest.ts`, ícones em `public/icons` (`node scripts/generate-icons.mjs`), `public/sw.js` + `public/offline.html`, registro em `components/pwa.tsx` (só produção) e instruções em /conta.
- Política de cache do SW: só `/_next/static/*`, `/icons/*` e `/offline.html`. Navegações sempre na rede (offline → página sem dados); GET de dados/RSC/API/PDF e qualquer POST nunca são interceptados. Páginas autenticadas saem com `Cache-Control: private, no-store`.
- Testes: `tests/e2e/responsive.mjs` (6 dispositivos × 34 telas: largura real, cortes, rolagem interna, fonte < 16px, alvos < 40px, erros de console) e `tests/e2e/pwa.mjs`.

## Estado atual (2026-10-26)
- Instalação no Supabase: `db/supabase/1-instalar.sql` (gerado por `npm run db:bundle`) + `2-acesso-e-proprietario.sql`.
- Todos os módulos implementados; lint, typecheck, 41 testes Vitest, build e E2E (42 passos) passando.
- Não foi feito deploy. Nenhuma credencial real configurada (WhatsApp em modo teste no .env local).
- Próximos passos sugeridos: ver "Pendências" em `docs/BUG_AUDIT.md`.
