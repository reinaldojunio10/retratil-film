import { Pool, types, type PoolClient } from "pg";

// numeric -> number, bigint (count) -> number, date -> 'YYYY-MM-DD' (sem fuso)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1082, (v) => v);

const g = globalThis as unknown as { __rfPool?: Pool };

function getPool() {
  if (!g.__rfPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não configurada");
    g.__rfPool = new Pool({
      connectionString,
      max: 10,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return g.__rfPool;
}

export type Row = Record<string, unknown>;

export class Db {
  constructor(private c: PoolClient) {}
  async many<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.c.query(sql, params)).rows as T[];
  }
  async one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
    return ((await this.c.query(sql, params)).rows[0] as T) ?? null;
  }
  async exec(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.c.query(sql, params)).rowCount ?? 0;
  }
}

/** Executa fn em uma transação identificada pela sessão (o RLS usa app.session). */
export async function withSession<T>(tokenHash: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.session', $1, true)", [tokenHash ?? ""]);
    const result = await fn(new Db(client));
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Traduz erros do Postgres para mensagens ao usuário. */
export function dbErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; constraint?: string };
  switch (err.code) {
    case "42501":
      return "Você não tem permissão para esta operação.";
    case "P0001":
      return err.message ?? "Operação não permitida.";
    case "23505":
      return "Já existe um registro com estes dados.";
    case "23503":
      return "Este registro está vinculado a outros dados e não pode ser removido.";
    case "23514":
      return "Dados inválidos para este registro.";
    case "22P02":
    case "22007":
    case "22008":
      return "Formato de dado inválido.";
    default:
      console.error("[db]", err.code, err.message);
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
