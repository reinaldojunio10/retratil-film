// Gera db/supabase/1-instalar.sql: todas as migrations em um único script para colar no SQL Editor do Supabase.
import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const dir = path.join(__dirname, "..", "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let out = `-- Retrátil Film — instalação completa do banco (gerado por scripts/bundle-supabase.ts; não editar)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Rode apenas uma vez.
begin;
create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());
do $$ begin
  if exists (select 1 from schema_migrations) then
    raise exception 'O banco já foi instalado. Para atualizar, use npm run db:migrate.';
  end if;
end $$;
`;
for (const f of files) {
  out += `\n-- ======================================================== ${f}\n${readFileSync(path.join(dir, f), "utf8")}\ninsert into schema_migrations(name) values ('${f}');\n`;
}
out += "\ncommit;\n";
writeFileSync(path.join(__dirname, "..", "db", "supabase", "1-instalar.sql"), out);
console.log(`db/supabase/1-instalar.sql (${files.length} migrations)`);
