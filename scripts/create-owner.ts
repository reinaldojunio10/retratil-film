// Cria (ou redefine a senha de) o usuário proprietário.
// Uso: OWNER_NAME="..." OWNER_EMAIL="..." OWNER_PASSWORD="..." npm run db:owner
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const { OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD, DATABASE_ADMIN_URL } = process.env;
  if (!DATABASE_ADMIN_URL || !OWNER_EMAIL || !OWNER_PASSWORD || !OWNER_NAME) throw new Error("Defina DATABASE_ADMIN_URL, OWNER_NAME, OWNER_EMAIL e OWNER_PASSWORD");
  if (OWNER_PASSWORD.length < 10) throw new Error("Use uma senha com pelo menos 10 caracteres");
  const c = new Client({ connectionString: DATABASE_ADMIN_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  const { rows } = await c.query(
    `insert into users(name, email, role) values ($1, lower($2), 'owner')
     on conflict (lower(email)) do update set role = 'owner', active = true returning id`,
    [OWNER_NAME, OWNER_EMAIL],
  );
  await c.query(
    `insert into user_credentials(user_id, password_hash) values ($1, crypt($2, gen_salt('bf', 10)))
     on conflict (user_id) do update set password_hash = excluded.password_hash, failed_attempts = 0, locked_until = null`,
    [rows[0].id, OWNER_PASSWORD],
  );
  await c.end();
  console.log(`Proprietário pronto: ${OWNER_EMAIL}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
