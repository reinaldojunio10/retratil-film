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
