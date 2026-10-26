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
