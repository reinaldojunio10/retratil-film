-- Retrátil Film — instalação completa do banco (gerado por scripts/bundle-supabase.ts; não editar)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Rode apenas uma vez.
begin;
create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());
do $$ begin
  if exists (select 1 from schema_migrations) then
    raise exception 'O banco já foi instalado. Para atualizar, use npm run db:migrate.';
  end if;
end $$;

-- ======================================================== 0001_schema.sql
-- Retrátil Film — esquema principal
-- Compatível com PostgreSQL 15+ / Supabase. Não destrutivo: só cria objetos.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- utilitários
create or replace function app_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- usuários e acesso
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  role text not null default 'comercial' check (role in ('owner','admin','comercial','producao','financeiro')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

create table user_credentials (
  user_id uuid primary key references users(id) on delete cascade,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  password_changed_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table role_permissions (
  role text not null check (role in ('admin','comercial','producao','financeiro')),
  module text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  primary key (role, module),
  check (not can_write or can_read)
);

create table company_settings (
  id int primary key default 1 check (id = 1),
  legal_name text not null default 'Retrátil Film',
  trade_name text not null default 'Retrátil Film',
  document text,
  address text,
  city text,
  state text,
  email text,
  phone text,
  website text,
  instagram text,
  bank_info text,
  proposal_footer text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- CRM
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  company text,
  document text,
  email text,
  phone text,
  whatsapp text,
  address text,
  city text,
  state text,
  source text not null default 'outro' check (source in ('indicacao','instagram','whatsapp','site','google','evento','cliente_antigo','outro')),
  notes text,
  owner_id uuid references users(id) on delete set null,
  archived_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_name_idx on clients (lower(name));
create index clients_whatsapp_idx on clients (whatsapp);
create index clients_active_idx on clients (archived_at);

create table client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null default 'outro' check (kind in ('ligacao','whatsapp','email','reuniao','visita','outro')),
  summary text not null check (length(trim(summary)) > 0),
  happened_at timestamptz not null default now(),
  user_id uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now()
);
create index client_interactions_client_idx on client_interactions(client_id, happened_at desc);

-- ---------------------------------------------------------------- serviços
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  description text,
  category text not null default 'producao' check (category in ('producao','captacao','edicao','locacao','outro')),
  unit text not null default 'projeto' check (unit in ('projeto','diaria','hora','unidade','minuto')),
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index services_name_key on services (lower(name));

-- ---------------------------------------------------------------- funil
create table deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  title text not null check (length(trim(title)) between 2 and 160),
  stage text not null default 'novo' check (stage in ('novo','contato','qualificacao','negociacao','orcamento','fechado','perdido')),
  value numeric(12,2) not null default 0 check (value >= 0),
  service_id uuid references services(id) on delete set null,
  owner_id uuid references users(id) on delete set null,
  next_contact_at timestamptz,
  expected_close date,
  lost_reason text,
  closed_at timestamptz,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_stage_idx on deals(stage);
create index deals_client_idx on deals(client_id);
create index deals_next_contact_idx on deals(next_contact_at) where stage not in ('fechado','perdido');

create or replace function deals_stage_dates() returns trigger
language plpgsql as $$
begin
  if new.stage in ('fechado','perdido') and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    new.closed_at := now();
  elsif new.stage not in ('fechado','perdido') then
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger deals_stage_dates before insert or update on deals for each row execute function deals_stage_dates();

-- ---------------------------------------------------------------- projetos
create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  client_id uuid references clients(id) on delete restrict,
  service_id uuid references services(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  status text not null default 'planejamento' check (status in ('planejamento','pre_producao','gravacao','edicao','revisao','entregue','cancelado')),
  location text,
  shoot_date timestamptz,
  delivery_date date,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  manager_id uuid references users(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_status_idx on projects(status);
create index projects_client_idx on projects(client_id);

create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  role text not null,
  created_at timestamptz not null default now()
);
create index project_members_project_idx on project_members(project_id);

create table project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  url text not null check (url ~* '^https?://'),
  notes text,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now()
);
create index project_files_project_idx on project_files(project_id);

-- ---------------------------------------------------------------- propostas
create sequence proposal_number_seq;
create table proposals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('RF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('proposal_number_seq')::text, 4, '0')),
  client_id uuid not null references clients(id) on delete restrict,
  deal_id uuid references deals(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 160),
  status text not null default 'rascunho' check (status in ('rascunho','enviada','aprovada','recusada','expirada','cancelada')),
  discount_type text not null default 'valor' check (discount_type in ('valor','percentual')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_terms text,
  valid_until date,
  notes text,
  sent_at timestamptz,
  decided_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percentual' or discount_value <= 100)
);
create index proposals_client_idx on proposals(client_id);
create index proposals_status_idx on proposals(status);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index proposal_items_proposal_idx on proposal_items(proposal_id, position);

-- total = subtotal - desconto (nunca negativo); calculado SEMPRE no banco
create or replace function proposals_compute_total() returns trigger
language plpgsql as $$
begin
  if new.discount_type = 'percentual' then
    new.total := round(new.subtotal * (1 - new.discount_value / 100), 2);
  else
    new.total := greatest(new.subtotal - new.discount_value, 0);
  end if;
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status is distinct from 'enviada') then
    new.sent_at := now();
  end if;
  if new.status in ('aprovada','recusada') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger proposals_compute_total before insert or update on proposals for each row execute function proposals_compute_total();

create or replace function proposal_items_recalc() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid := coalesce(new.proposal_id, old.proposal_id);
begin
  update proposals set subtotal = coalesce((
    select round(sum(quantity * unit_price), 2) from proposal_items where proposal_id = pid
  ), 0) where id = pid;
  if tg_op = 'UPDATE' and old.proposal_id <> new.proposal_id then
    update proposals set subtotal = coalesce((
      select round(sum(quantity * unit_price), 2) from proposal_items where proposal_id = old.proposal_id
    ), 0) where id = old.proposal_id;
  end if;
  return null;
end $$;
create trigger proposal_items_recalc after insert or update or delete on proposal_items for each row execute function proposal_items_recalc();

-- ---------------------------------------------------------------- contratos
create table contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence contract_number_seq;
create table contracts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('contract_number_seq')::text, 4, '0')),
  client_id uuid not null references clients(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,
  proposal_id uuid references proposals(id) on delete set null,
  template_id uuid references contract_templates(id) on delete set null,
  title text not null,
  body text not null,
  value numeric(12,2) not null default 0 check (value >= 0),
  start_date date,
  end_date date,
  status text not null default 'rascunho' check (status in ('rascunho','emitido','assinado_manual','cancelado')),
  signed_note text,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index contracts_client_idx on contracts(client_id);

-- ---------------------------------------------------------------- tarefas e agenda
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 200),
  description text,
  kind text not null default 'tarefa' check (kind in ('tarefa','compromisso')),
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluida','cancelada')),
  due_at timestamptz,
  location text,
  assignee_id uuid references users(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_due_idx on tasks(due_at) where status in ('pendente','em_andamento');
create index tasks_project_idx on tasks(project_id);
create index tasks_assignee_idx on tasks(assignee_id);

create or replace function tasks_completed_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status <> 'concluida') then
    new.completed_at := now();
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_completed_at before insert or update on tasks for each row execute function tasks_completed_at();

-- ---------------------------------------------------------------- financeiro
create table transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita','despesa')),
  description text not null check (length(trim(description)) between 2 and 200),
  category text not null default 'outros',
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  paid_at date,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  payment_method text,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  proposal_id uuid references proposals(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pago') = (paid_at is not null))
);
create index transactions_due_idx on transactions(due_date);
create index transactions_type_status_idx on transactions(type, status);
create index transactions_project_idx on transactions(project_id);

-- ---------------------------------------------------------------- equipamentos
create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  category text not null default 'camera' check (category in ('camera','lente','audio','iluminacao','suporte','drone','acessorio','informatica','outro')),
  brand text,
  model text,
  serial_number text,
  quantity int not null default 1 check (quantity >= 0),
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  replacement_value numeric(12,2) check (replacement_value >= 0),
  status text not null default 'ativo' check (status in ('ativo','manutencao','inativo')),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'reservado' check (status in ('reservado','retirado','devolvido','cancelado')),
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  total numeric(12,2) not null default 0,
  conditions text,
  picked_up_at timestamptz,
  returned_at timestamptz,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index reservations_equipment_period_idx on reservations(equipment_id, start_at, end_at);

-- impede reservas conflitantes (soma das quantidades sobrepostas > estoque)
create or replace function reservations_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  eq record;
  used int;
  days int;
begin
  days := greatest(1, ceil(extract(epoch from (new.end_at - new.start_at)) / 86400.0)::int);
  new.total := round(days * new.daily_rate * new.quantity, 2);
  if new.status = 'retirado' and new.picked_up_at is null then new.picked_up_at := now(); end if;
  if new.status = 'devolvido' and new.returned_at is null then new.returned_at := now(); end if;
  if new.status in ('cancelado','devolvido') then
    return new;
  end if;
  select * into eq from equipment where id = new.equipment_id for update;
  if eq.status <> 'ativo' and (tg_op = 'INSERT' or old.status <> 'retirado') then
    raise exception 'Equipamento indisponível (status: %).', eq.status using errcode = 'P0001';
  end if;
  select coalesce(sum(quantity), 0) into used from reservations
   where equipment_id = new.equipment_id
     and id <> new.id
     and status in ('reservado','retirado')
     and tstzrange(start_at, end_at) && tstzrange(new.start_at, new.end_at);
  if used + new.quantity > eq.quantity then
    raise exception 'Conflito de reserva: % de % unidade(s) já reservada(s) no período.', used, eq.quantity using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reservations_check before insert or update on reservations for each row execute function reservations_check();

-- ---------------------------------------------------------------- WhatsApp
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[a-z0-9_]+$' and length(name) <= 512),
  language text not null default 'pt_BR',
  category text not null default 'utility' check (category in ('utility','marketing','authentication')),
  purpose text not null default 'geral' check (purpose in ('geral','followup','proposta','tarefa','boas_vindas')),
  body_preview text not null,
  variables int not null default 0 check (variables between 0 and 10),
  approved boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, language)
);

create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  phone text not null,
  body text,
  template_id uuid references whatsapp_templates(id) on delete set null,
  template_params jsonb,
  wa_message_id text unique,
  status text not null default 'rascunho' check (status in ('rascunho','simulado','enviando','enviado','entregue','lido','falhou','recebido')),
  error text,
  source text not null default 'manual' check (source in ('manual','automacao','webhook')),
  related_type text,
  related_id uuid,
  created_by uuid references users(id) on delete set null default app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_messages_client_idx on whatsapp_messages(client_id, created_at desc);
create index whatsapp_messages_phone_idx on whatsapp_messages(phone, created_at desc);
create unique index whatsapp_messages_automation_key on whatsapp_messages(related_type, related_id, ((created_at at time zone 'UTC')::date)) where source = 'automacao';

create table webhook_events (
  id bigserial primary key,
  provider text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- auditoria
create table audit_log (
  id bigserial primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  user_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_record_idx on audit_log(table_name, record_id, created_at desc);

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  diff jsonb;
  rid uuid;
begin
  if tg_op = 'INSERT' then
    rid := new.id; diff := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    rid := new.id;
    select jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value)) into diff
      from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o on o.key = n.key
     where n.value is distinct from o.value and n.key not in ('updated_at');
    if diff is null then return new; end if;
  else
    rid := old.id; diff := to_jsonb(old);
  end if;
  insert into audit_log(table_name, record_id, action, user_id, changes)
  values (tg_table_name, rid, lower(tg_op), app_user_id(), diff);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['users','clients','deals','services','projects','proposals','contracts','contract_templates','tasks','transactions','equipment','reservations','whatsapp_templates','company_settings']
  loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
  foreach t in array array['users','clients','deals','services','projects','proposals','proposal_items','contracts','contract_templates','transactions','equipment','reservations']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit_trigger()', t, t);
  end loop;
end $$;

insert into schema_migrations(name) values ('0001_schema.sql');

-- ======================================================== 0002_security.sql
-- Retrátil Film — autenticação, permissões e RLS
-- O app conecta com um papel de login membro de "app_runtime" (sem ser dono das tabelas),
-- portanto TODAS as consultas passam pelas políticas abaixo.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin;
  end if;
end $$;

-- ---------------------------------------------------------------- identidade da requisição
-- O servidor define, por transação: set_config('app.session', <sha256 do token>, true).
-- O usuário só é reconhecido se a sessão existir e não estiver expirada.
create or replace function app_user_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select s.user_id from sessions s join users u on u.id = s.user_id
   where s.token_hash = nullif(current_setting('app.session', true), '')
     and s.expires_at > now() and u.active
$$;

create or replace function app_current_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from users where id = app_user_id()
$$;

create or replace function app_can(p_module text, p_write boolean) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select case when r = 'owner' then true else (
       select case when p_write then rp.can_write else rp.can_read end
         from role_permissions rp where rp.role = r and rp.module = p_module) end
       from app_current_role() r),
    false)
$$;

create or replace function normalize_phone(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) in (10, 11) then '55' || regexp_replace(p, '\D', '', 'g')
    else nullif(regexp_replace(p, '\D', '', 'g'), '')
  end
$$;

-- ---------------------------------------------------------------- login / sessão
create or replace function app_login(p_email text, p_password text, p_token_hash text, p_ttl_seconds int, p_ip text, p_user_agent text)
returns table(status text, user_id uuid)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u record;
  c record;
begin
  select * into u from users where lower(email) = lower(trim(p_email));
  if not found then
    perform crypt(p_password, gen_salt('bf', 10)); -- tempo de resposta semelhante
    return query select 'invalid'::text, null::uuid; return;
  end if;
  select * into c from user_credentials where user_credentials.user_id = u.id for update;
  if not found or not u.active then
    perform crypt(p_password, gen_salt('bf', 10));
    return query select 'invalid'::text, null::uuid; return;
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    return query select 'locked'::text, null::uuid; return;
  end if;
  if crypt(p_password, c.password_hash) <> c.password_hash then
    update user_credentials set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
     where user_credentials.user_id = u.id;
    return query select 'invalid'::text, null::uuid; return;
  end if;
  update user_credentials set failed_attempts = 0, locked_until = null where user_credentials.user_id = u.id;
  delete from sessions where sessions.user_id = u.id and expires_at < now();
  insert into sessions(user_id, token_hash, expires_at, ip, user_agent)
  values (u.id, p_token_hash, now() + make_interval(secs => p_ttl_seconds), left(p_ip, 64), left(p_user_agent, 300));
  return query select 'ok'::text, u.id;
end $$;

create or replace function app_session_user(p_token_hash text)
returns table(id uuid, name text, email text, role text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update sessions set last_seen_at = now()
   where token_hash = p_token_hash and expires_at > now() and last_seen_at < now() - interval '5 minutes';
  return query select u.id, u.name, u.email, u.role from sessions s join users u on u.id = s.user_id
   where s.token_hash = p_token_hash and s.expires_at > now() and u.active;
end $$;

create or replace function app_logout(p_token_hash text) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from sessions where token_hash = p_token_hash
$$;

-- Proprietário define senha de qualquer usuário (e encerra as sessões dele)
create or replace function app_set_password(p_user_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if app_current_role() is distinct from 'owner' then
    raise exception 'Apenas o proprietário pode definir senhas de outros usuários.' using errcode = '42501';
  end if;
  if length(p_password) < 8 then
    raise exception 'A senha deve ter pelo menos 8 caracteres.' using errcode = 'P0001';
  end if;
  insert into user_credentials(user_id, password_hash) values (p_user_id, crypt(p_password, gen_salt('bf', 10)))
  on conflict (user_id) do update set password_hash = excluded.password_hash, failed_attempts = 0, locked_until = null, password_changed_at = now();
  if p_user_id <> app_user_id() then
    delete from sessions where user_id = p_user_id;
  end if;
end $$;

-- Usuário altera a própria senha (exige a senha atual)
create or replace function app_change_password(p_current text, p_new text) returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare uid uuid := app_user_id(); h text;
begin
  if uid is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if length(p_new) < 8 then raise exception 'A senha deve ter pelo menos 8 caracteres.' using errcode = 'P0001'; end if;
  select password_hash into h from user_credentials where user_id = uid;
  if h is null or crypt(p_current, h) <> h then return false; end if;
  update user_credentials set password_hash = crypt(p_new, gen_salt('bf', 10)), password_changed_at = now() where user_id = uid;
  delete from sessions where user_id = uid and token_hash <> current_setting('app.session', true);
  return true;
end $$;

-- Deve existir sempre ao menos um proprietário ativo
create or replace function users_keep_owner() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active) then
    if not exists (select 1 from users where role = 'owner' and active and id <> old.id) then
      raise exception 'É necessário manter ao menos um proprietário ativo.' using errcode = 'P0001';
    end if;
  end if;
  if new.active = false then
    delete from sessions where user_id = new.id;
  end if;
  return new;
end $$;
create trigger users_keep_owner before update on users for each row execute function users_keep_owner();

-- ---------------------------------------------------------------- RLS
alter table users enable row level security;
alter table user_credentials enable row level security;
alter table sessions enable row level security;
alter table role_permissions enable row level security;
alter table company_settings enable row level security;
alter table audit_log enable row level security;
alter table webhook_events enable row level security;

create policy users_select on users for select using ((select app_user_id()) is not null);
create policy users_insert on users for insert with check ((select app_current_role()) = 'owner');
create policy users_update on users for update using ((select app_current_role()) = 'owner') with check ((select app_current_role()) = 'owner');

create policy role_permissions_select on role_permissions for select using ((select app_user_id()) is not null);
create policy role_permissions_write on role_permissions for all using ((select app_current_role()) = 'owner') with check ((select app_current_role()) = 'owner');

create policy company_settings_select on company_settings for select using ((select app_user_id()) is not null);
create policy company_settings_update on company_settings for update using ((select app_can('configuracoes', true))) with check ((select app_can('configuracoes', true)));

create policy audit_log_select on audit_log for select using ((select app_can('configuracoes', false)));
create policy webhook_events_select on webhook_events for select using ((select app_can('whatsapp', false)));
-- user_credentials e sessions: nenhuma política => inacessíveis ao app (somente via funções acima)

do $$
declare
  r record;
begin
  for r in select * from (values
    ('clients','clientes'), ('client_interactions','clientes'),
    ('deals','funil'), ('services','servicos'),
    ('proposals','propostas'), ('proposal_items','propostas'),
    ('contract_templates','contratos'), ('contracts','contratos'),
    ('projects','projetos'), ('project_members','projetos'), ('project_files','projetos'),
    ('tasks','tarefas'), ('transactions','financeiro'),
    ('equipment','equipamentos'), ('reservations','equipamentos'),
    ('whatsapp_templates','whatsapp'), ('whatsapp_messages','whatsapp')
  ) as t(tbl, module)
  loop
    execute format('alter table %I enable row level security', r.tbl);
    execute format('create policy %I on %I for select using ((select app_can(%L, false)))', r.tbl || '_select', r.tbl, r.module);
    execute format('create policy %I on %I for insert with check ((select app_can(%L, true)))', r.tbl || '_insert', r.tbl, r.module);
    execute format('create policy %I on %I for update using ((select app_can(%L, true))) with check ((select app_can(%L, true)))', r.tbl || '_update', r.tbl, r.module, r.module);
    execute format('create policy %I on %I for delete using ((select app_can(%L, true)))', r.tbl || '_delete', r.tbl, r.module);
  end loop;
end $$;

-- Exclusão controlada: propostas e contratos só podem ser excluídos em rascunho
drop policy proposals_delete on proposals;
create policy proposals_delete on proposals for delete using ((select app_can('propostas', true)) and status = 'rascunho');
drop policy contracts_delete on contracts;
create policy contracts_delete on contracts for delete using ((select app_can('contratos', true)) and status = 'rascunho');

-- Tarefas: quem tem leitura em tarefas vê todas; pode alterar as próprias ou, com escrita, qualquer uma
drop policy tasks_update on tasks;
create policy tasks_update on tasks for update
  using ((select app_can('tarefas', true)) or assignee_id = (select app_user_id()))
  with check ((select app_can('tarefas', true)) or assignee_id = (select app_user_id()));

-- ---------------------------------------------------------------- privilégios
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;

do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke execute on all functions in schema public from %I', r);
    end if;
  end loop;
end $$;

grant usage on schema public to app_runtime;
grant select, insert, update on
  users, role_permissions, company_settings,
  clients, client_interactions, deals, services, proposals, proposal_items,
  contract_templates, contracts, projects, project_members, project_files,
  tasks, transactions, equipment, reservations, whatsapp_templates, whatsapp_messages
to app_runtime;
-- DELETE apenas onde a exclusão é segura; clientes/transações/usuários são arquivados ou cancelados
grant delete on client_interactions, proposals, proposal_items, contracts, contract_templates,
  project_members, project_files, tasks, whatsapp_templates, role_permissions to app_runtime;
grant select on audit_log, webhook_events to app_runtime;
grant usage on all sequences in schema public to app_runtime;
grant execute on all functions in schema public to app_runtime;

insert into schema_migrations(name) values ('0002_security.sql');

-- ======================================================== 0003_whatsapp_automations.sql
-- Retrátil Film — processamento de webhook do WhatsApp e automações comerciais
-- As automações NUNCA enviam mensagens: criam rascunhos e tarefas para revisão humana.

create or replace function app_whatsapp_ingest(p_payload jsonb, p_signature_valid boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev_id bigint;
  change jsonb;
  m jsonb;
  st jsonb;
  inbound int := 0;
  updated int := 0;
  phone text;
  cid uuid;
  new_status text;
begin
  insert into webhook_events(provider, signature_valid, payload) values ('whatsapp', p_signature_valid, p_payload) returning id into ev_id;
  if not p_signature_valid then
    update webhook_events set error = 'assinatura inválida' where id = ev_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_signature');
  end if;
  for change in select c from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) e,
                       jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) c
  loop
    for m in select * from jsonb_array_elements(coalesce(change->'value'->'messages', '[]'::jsonb)) loop
      phone := normalize_phone(m->>'from');
      select id into cid from clients
       where archived_at is null and (normalize_phone(whatsapp) = phone or normalize_phone(phone) = phone)
       order by created_at limit 1;
      insert into whatsapp_messages(client_id, direction, phone, body, wa_message_id, status, source, created_by)
      values (cid, 'in', phone,
              coalesce(m->'text'->>'body', m->'button'->>'text', m->'interactive'->'button_reply'->>'title', '[' || coalesce(m->>'type', 'mensagem') || ']'),
              m->>'id', 'recebido', 'webhook', null)
      on conflict (wa_message_id) do nothing;
      inbound := inbound + 1;
    end loop;
    for st in select * from jsonb_array_elements(coalesce(change->'value'->'statuses', '[]'::jsonb)) loop
      new_status := case st->>'status' when 'sent' then 'enviado' when 'delivered' then 'entregue' when 'read' then 'lido' when 'failed' then 'falhou' end;
      if new_status is not null then
        update whatsapp_messages set status = new_status,
               error = case when new_status = 'falhou' then coalesce(st->'errors'->0->>'title', 'falha informada pela Meta') else error end
         where wa_message_id = st->>'id'
           -- não regride status (ex.: "entregue" chegando depois de "lido")
           and array_position(array['enviando','enviado','entregue','lido'], status) is not null
           and (new_status = 'falhou' or array_position(array['enviando','enviado','entregue','lido'], new_status) > array_position(array['enviando','enviado','entregue','lido'], status));
        updated := updated + 1;
      end if;
    end loop;
  end loop;
  update webhook_events set processed = true where id = ev_id;
  return jsonb_build_object('ok', true, 'inbound', inbound, 'statuses', updated);
end $$;

create or replace function app_run_automations() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  tpl record;
  drafts int := 0;
  new_tasks int := 0;
  n int;
begin
  if app_user_id() is not null and not app_can('whatsapp', true) then
    raise exception 'Sem permissão para executar automações.' using errcode = '42501';
  end if;

  -- 1) Follow-up comercial: próximos contatos vencidos
  select * into tpl from whatsapp_templates where purpose = 'followup' and active order by approved desc, created_at limit 1;
  for r in select d.*, c.name client_name, c.whatsapp, c.phone client_phone from deals d join clients c on c.id = d.client_id
            where d.stage not in ('fechado','perdido') and d.next_contact_at <= now() and c.archived_at is null loop
    if coalesce(r.whatsapp, r.client_phone) is not null then
      insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
      values (r.client_id, 'out', normalize_phone(coalesce(r.whatsapp, r.client_phone)),
              coalesce(replace(tpl.body_preview, '{{1}}', split_part(r.client_name, ' ', 1)), 'Olá ' || split_part(r.client_name, ' ', 1) || ', tudo bem? Passando para dar continuidade à nossa conversa sobre ' || r.title || '.'),
              tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.client_name, ' ', 1)) end,
              'rascunho', 'automacao', 'deal', r.id, null)
      on conflict do nothing;
      get diagnostics n = row_count; drafts := drafts + n;
    end if;
    if not exists (select 1 from tasks where deal_id = r.id and status in ('pendente','em_andamento') and title like 'Follow-up:%') then
      insert into tasks(title, kind, priority, due_at, assignee_id, client_id, deal_id, created_by)
      values ('Follow-up: ' || r.title, 'tarefa', 'alta', now(), coalesce(r.owner_id, r.created_by), r.client_id, r.id, null);
      new_tasks := new_tasks + 1;
    end if;
  end loop;

  -- 2) Propostas enviadas vencendo em até 3 dias
  select * into tpl from whatsapp_templates where purpose = 'proposta' and active order by approved desc, created_at limit 1;
  for r in select p.*, c.name client_name, c.whatsapp, c.phone client_phone from proposals p join clients c on c.id = p.client_id
            where p.status = 'enviada' and p.valid_until between current_date and current_date + 3 loop
    if coalesce(r.whatsapp, r.client_phone) is not null then
      insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
      values (r.client_id, 'out', normalize_phone(coalesce(r.whatsapp, r.client_phone)),
              coalesce(replace(replace(tpl.body_preview, '{{1}}', split_part(r.client_name, ' ', 1)), '{{2}}', r.code),
                       'Olá ' || split_part(r.client_name, ' ', 1) || ', a proposta ' || r.code || ' é válida até ' || to_char(r.valid_until, 'DD/MM/YYYY') || '. Posso ajudar com alguma dúvida?'),
              tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.client_name, ' ', 1), r.code) end,
              'rascunho', 'automacao', 'proposal', r.id, null)
      on conflict do nothing;
      get diagnostics n = row_count; drafts := drafts + n;
    end if;
    if not exists (select 1 from tasks where client_id = r.client_id and status in ('pendente','em_andamento') and title = 'Proposta vencendo: ' || r.code) then
      insert into tasks(title, kind, priority, due_at, assignee_id, client_id, created_by)
      values ('Proposta vencendo: ' || r.code, 'tarefa', 'alta', r.valid_until::timestamptz, r.created_by, r.client_id, null);
      new_tasks := new_tasks + 1;
    end if;
  end loop;

  -- 3) Lembrete de tarefas das próximas 24h para o responsável (telefone do usuário)
  select * into tpl from whatsapp_templates where purpose = 'tarefa' and active order by approved desc, created_at limit 1;
  for r in select t.*, u.name user_name, u.phone user_phone from tasks t join users u on u.id = t.assignee_id
            where t.status in ('pendente','em_andamento') and t.due_at between now() and now() + interval '24 hours'
              and u.phone is not null and u.active loop
    insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
    values (null, 'out', normalize_phone(r.user_phone),
            coalesce(replace(replace(tpl.body_preview, '{{1}}', split_part(r.user_name, ' ', 1)), '{{2}}', r.title),
                     'Lembrete: "' || r.title || '" vence em ' || to_char(r.due_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'),
            tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.user_name, ' ', 1), r.title) end,
            'rascunho', 'automacao', 'task', r.id, null)
    on conflict do nothing;
    get diagnostics n = row_count; drafts := drafts + n;
  end loop;

  return jsonb_build_object('rascunhos', drafts, 'tarefas', new_tasks, 'executado_em', now());
end $$;

revoke execute on function app_whatsapp_ingest(jsonb, boolean) from public;
revoke execute on function app_run_automations() from public;
grant execute on function app_whatsapp_ingest(jsonb, boolean) to app_runtime;
grant execute on function app_run_automations() to app_runtime;

insert into schema_migrations(name) values ('0003_whatsapp_automations.sql');

-- ======================================================== 0004_base_data.sql
-- Retrátil Film — dados de configuração iniciais (não são dados de clientes)

insert into company_settings(id) values (1) on conflict do nothing;

-- Matriz padrão de permissões (o proprietário tem acesso total e pode alterá-la em /usuarios)
insert into role_permissions(role, module, can_read, can_write)
select r, m,
  case
    when r = 'admin' then true
    when r = 'comercial' then m in ('dashboard','clientes','funil','servicos','propostas','contratos','projetos','tarefas','whatsapp','relatorios','equipamentos')
    when r = 'producao' then m in ('dashboard','clientes','servicos','projetos','tarefas','equipamentos')
    when r = 'financeiro' then m in ('dashboard','clientes','servicos','propostas','contratos','projetos','tarefas','financeiro','relatorios')
  end,
  case
    when r = 'admin' then m <> 'usuarios'
    when r = 'comercial' then m in ('clientes','funil','propostas','contratos','tarefas','whatsapp')
    when r = 'producao' then m in ('projetos','tarefas','equipamentos')
    when r = 'financeiro' then m in ('financeiro','tarefas')
  end
from unnest(array['admin','comercial','producao','financeiro']) r,
     unnest(array['dashboard','clientes','funil','servicos','propostas','contratos','projetos','tarefas','financeiro','equipamentos','whatsapp','relatorios','usuarios','configuracoes']) m
on conflict do nothing;

-- Catálogo de serviços (valores em 0 — configure em Serviços)
insert into services(name, category, unit, description) values
  ('Gravação de DVD musical', 'producao', 'projeto', 'Captação multicâmera, áudio e pós-produção de DVD/projeto audiovisual musical.'),
  ('Videoclipe', 'producao', 'projeto', 'Roteiro, direção, captação e edição de videoclipe.'),
  ('Captação de show', 'captacao', 'diaria', 'Filmagem de apresentação ao vivo.'),
  ('Conteúdo para artistas', 'producao', 'projeto', 'Pacote de conteúdo para redes sociais de artistas.'),
  ('Vídeo institucional para empresas', 'producao', 'projeto', 'Produção de vídeo institucional ou comercial.'),
  ('Filmagem de evento', 'captacao', 'diaria', 'Cobertura audiovisual de eventos.'),
  ('Edição de vídeo', 'edicao', 'projeto', 'Edição, color e finalização.'),
  ('Locação de equipamentos', 'locacao', 'diaria', 'Locação de câmeras, lentes, áudio e iluminação.')
on conflict do nothing;

insert into contract_templates(name, body) values (
'Prestação de serviços audiovisuais (modelo base — revisar com advogado)',
$t$CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUDIOVISUAIS

CONTRATANTE: {{contratante_nome}}, inscrito(a) sob o documento {{contratante_documento}}, com endereço em {{contratante_endereco}}, {{contratante_cidade}}, e-mail {{contratante_email}}, telefone {{contratante_telefone}}.

CONTRATADA: {{contratada_nome}}, inscrita sob o documento {{contratada_documento}}, com endereço em {{contratada_endereco}}, {{contratada_cidade}}.

CLÁUSULA 1 — OBJETO
A CONTRATADA prestará ao CONTRATANTE os seguintes serviços, referentes ao projeto "{{projeto}}":
{{servicos}}

CLÁUSULA 2 — LOCAL E PRAZOS
Local de execução: {{local}}. Início: {{data_inicio}}. Término/entrega: {{data_fim}}.

CLÁUSULA 3 — VALOR E PAGAMENTO
Pelos serviços, o CONTRATANTE pagará o valor total de {{valor_total}}, nas seguintes condições: {{condicoes_pagamento}}.

CLÁUSULA 4 — OBRIGAÇÕES
A CONTRATADA se compromete a executar os serviços com qualidade técnica e dentro dos prazos acordados. O CONTRATANTE se compromete a fornecer as informações, acessos e autorizações necessárias à execução.

CLÁUSULA 5 — DIREITOS DE IMAGEM E USO
O material produzido poderá ser utilizado pela CONTRATADA em seu portfólio, salvo manifestação contrária por escrito do CONTRATANTE.

CLÁUSULA 6 — CANCELAMENTO
Em caso de cancelamento pelo CONTRATANTE, os valores referentes a custos já incorridos não serão reembolsados.

CLÁUSULA 7 — FORO
Fica eleito o foro da comarca de {{contratada_cidade}} para dirimir quaisquer dúvidas oriundas deste contrato.

{{contratada_cidade}}, {{data_atual}}.


_______________________________________
{{contratante_nome}} — CONTRATANTE


_______________________________________
{{contratada_nome}} — CONTRATADA
$t$);

-- Modelos de mensagem: precisam ser criados e APROVADOS no WhatsApp Manager antes do uso real
insert into whatsapp_templates(name, language, category, purpose, body_preview, variables, approved) values
  ('retratil_followup', 'pt_BR', 'utility', 'followup', 'Olá {{1}}, tudo bem? Aqui é da Retrátil Film. Passando para dar continuidade ao seu atendimento. Podemos conversar?', 1, false),
  ('retratil_proposta_validade', 'pt_BR', 'utility', 'proposta', 'Olá {{1}}! Lembrando que a proposta {{2}} da Retrátil Film está próxima do vencimento. Ficamos à disposição para dúvidas.', 2, false),
  ('retratil_lembrete_tarefa', 'pt_BR', 'utility', 'tarefa', 'Olá {{1}}, lembrete da Retrátil Film: {{2}}.', 2, false)
on conflict do nothing;

insert into schema_migrations(name) values ('0004_base_data.sql');

-- ======================================================== 0005_whatsapp_drafts.sql
-- Permite descartar rascunhos de mensagens (somente rascunhos; histórico enviado/recebido é preservado)
grant delete on whatsapp_messages to app_runtime;
drop policy if exists whatsapp_messages_delete on whatsapp_messages;
create policy whatsapp_messages_delete on whatsapp_messages for delete using ((select app_can('whatsapp', true)) and status = 'rascunho');

insert into schema_migrations(name) values ('0005_whatsapp_drafts.sql');

-- ======================================================== 0006_fix_whatsapp_ingest.sql
-- Corrige referência ambígua à coluna "phone" (BUG-001)
create or replace function app_whatsapp_ingest(p_payload jsonb, p_signature_valid boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev_id bigint;
  change jsonb;
  m jsonb;
  st jsonb;
  inbound int := 0;
  updated int := 0;
  v_phone text;
  cid uuid;
  new_status text;
begin
  insert into webhook_events(provider, signature_valid, payload) values ('whatsapp', p_signature_valid, p_payload) returning id into ev_id;
  if not p_signature_valid then
    update webhook_events set error = 'assinatura inválida' where id = ev_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_signature');
  end if;
  for change in select c from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) e,
                       jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) c
  loop
    for m in select * from jsonb_array_elements(coalesce(change->'value'->'messages', '[]'::jsonb)) loop
      v_phone := normalize_phone(m->>'from');
      select id into cid from clients
       where archived_at is null and (normalize_phone(clients.whatsapp) = v_phone or normalize_phone(clients.phone) = v_phone)
       order by created_at limit 1;
      insert into whatsapp_messages(client_id, direction, phone, body, wa_message_id, status, source, created_by)
      values (cid, 'in', v_phone,
              coalesce(m->'text'->>'body', m->'button'->>'text', m->'interactive'->'button_reply'->>'title', '[' || coalesce(m->>'type', 'mensagem') || ']'),
              m->>'id', 'recebido', 'webhook', null)
      on conflict (wa_message_id) do nothing;
      inbound := inbound + 1;
    end loop;
    for st in select * from jsonb_array_elements(coalesce(change->'value'->'statuses', '[]'::jsonb)) loop
      new_status := case st->>'status' when 'sent' then 'enviado' when 'delivered' then 'entregue' when 'read' then 'lido' when 'failed' then 'falhou' end;
      if new_status is not null then
        update whatsapp_messages set status = new_status,
               error = case when new_status = 'falhou' then coalesce(st->'errors'->0->>'title', 'falha informada pela Meta') else error end
         where wa_message_id = st->>'id'
           -- não regride status (ex.: "entregue" chegando depois de "lido")
           and array_position(array['enviando','enviado','entregue','lido'], status) is not null
           and (new_status = 'falhou' or array_position(array['enviando','enviado','entregue','lido'], new_status) > array_position(array['enviando','enviado','entregue','lido'], status));
        updated := updated + 1;
      end if;
    end loop;
  end loop;
  update webhook_events set processed = true where id = ev_id;
  return jsonb_build_object('ok', true, 'inbound', inbound, 'statuses', updated);
end $$;

insert into schema_migrations(name) values ('0006_fix_whatsapp_ingest.sql');

-- ======================================================== 0007_supabase_hardening.sql
-- Supabase concede automaticamente acesso a "anon"/"authenticated" (Data API/PostgREST) em objetos
-- novos do schema public. Este app não usa a Data API: revoga tudo e impede concessões futuras.
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to app_runtime;

do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke execute on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke execute on functions from %I', r);
    end if;
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public;

insert into schema_migrations(name) values ('0007_supabase_hardening.sql');

commit;
