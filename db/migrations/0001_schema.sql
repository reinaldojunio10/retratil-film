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
