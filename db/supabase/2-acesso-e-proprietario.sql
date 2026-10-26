-- Retrátil Film — usuário de conexão do app + seu acesso de proprietário.
-- ANTES DE RODAR, troque os 4 valores entre aspas marcados com TROQUE. Não compartilhe este texto preenchido.
begin;

-- 1) Papel que o app usa para conectar (sem privilégios de dono; sujeito às permissões/RLS)
create role retratil_app login password 'TROQUE_SENHA_DO_APP';
grant app_runtime to retratil_app;

-- 2) Seu usuário proprietário no sistema
with u as (
  insert into users(name, email, role) values ('TROQUE_SEU_NOME', lower('TROQUE_SEU_EMAIL'), 'owner') returning id
)
insert into user_credentials(user_id, password_hash)
select id, extensions.crypt('TROQUE_SUA_SENHA_DE_LOGIN', extensions.gen_salt('bf', 10)) from u;

commit;
