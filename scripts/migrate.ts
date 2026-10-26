// Aplica as migrations de db/migrations em ordem, uma única vez cada (tabela schema_migrations).
import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Client } from "pg";

export async function migrate(url: string, log = console.log) {
  const client = new Client({ connectionString: url, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
    const dir = path.join(__dirname, "..", "db", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await client.query("begin");
      try {
        await client.query(readFileSync(path.join(dir, file), "utf8"));
        await client.query("insert into schema_migrations(name) values ($1)", [file]);
        await client.query("commit");
        log(`✔ ${file}`);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`Falha em ${file}: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("Defina DATABASE_ADMIN_URL");
  migrate(url).then(() => console.log("Migrations concluídas."), (e) => { console.error(e.message); process.exit(1); });
}
