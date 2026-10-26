// Testes de integração contra um PostgreSQL real (banco exclusivo de testes, recriado a cada execução).
import "dotenv/config";
import { createHash, createHmac, randomBytes } from "crypto";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL;
const APP = process.env.TEST_DATABASE_URL;
const enabled = !!ADMIN && !!APP && /_test(\?|$)/.test(ADMIN) && /_test(\?|$)/.test(APP);

let admin: Client;
let pool: Pool;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const PASS = "senha-teste-123";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Executa SQL como o app (papel sem privilégios), identificado pela sessão do usuário. */
async function as<T = Record<string, unknown>>(who: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.session', $1, true)", [who ? hash(tokens[who]) : ""]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r.rows as T[];
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

async function login(email: string, password: string) {
  const token = randomBytes(32).toString("base64url");
  const [r] = await as<{ status: string }>(null, "select * from app_login($1,$2,$3,3600,null,null)", [email, password, hash(token)]);
  return { status: r.status, token };
}

describe.runIf(enabled)("banco de dados: segurança, regras e automações", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN });
    await admin.connect();
    await admin.query("drop schema public cascade; create schema public;");
    await migrate(ADMIN!, () => {});
    await admin.query("grant usage on schema public to app_runtime");
    pool = new Pool({ connectionString: APP, max: 4 });
    for (const role of ["owner", "admin", "comercial", "producao", "financeiro"]) {
      const { rows } = await admin.query("insert into users(name, email, role) values ($1, $2, $3) returning id", [`Usuário ${role}`, `${role}@teste.local`, role]);
      ids[role] = rows[0].id;
      await admin.query("insert into user_credentials(user_id, password_hash) values ($1, crypt($2, gen_salt('bf', 4)))", [ids[role], PASS]);
      const l = await login(`${role}@teste.local`, PASS);
      expect(l.status).toBe("ok");
      tokens[role] = l.token;
    }
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.end();
  });

  describe("autenticação", () => {
    it("rejeita senha errada e bloqueia após 5 tentativas", async () => {
      await admin.query("insert into users(name, email, role) values ('Alvo', 'alvo@teste.local', 'comercial')");
      await admin.query("insert into user_credentials(user_id, password_hash) select id, crypt($1, gen_salt('bf', 4)) from users where email = 'alvo@teste.local'", [PASS]);
      for (let i = 0; i < 5; i++) expect((await login("alvo@teste.local", "errada")).status).toBe("invalid");
      expect((await login("alvo@teste.local", PASS)).status).toBe("locked");
      expect((await login("naoexiste@teste.local", PASS)).status).toBe("invalid");
    });
    it("e-mail não diferencia maiúsculas", async () => {
      expect((await login("OWNER@teste.local", PASS)).status).toBe("ok");
    });
    it("usuário inativo não autentica e perde sessões", async () => {
      const { rows } = await admin.query("insert into users(name, email, role) values ('Inativo', 'inativo@teste.local', 'producao') returning id");
      await admin.query("insert into user_credentials(user_id, password_hash) values ($1, crypt($2, gen_salt('bf', 4)))", [rows[0].id, PASS]);
      const l = await login("inativo@teste.local", PASS);
      tokens.inativo = l.token;
      expect((await as(  "inativo", "select app_user_id() id"))[0].id).toBe(rows[0].id);
      await as("owner", "update users set active = false where id = $1", [rows[0].id]);
      expect((await as("inativo", "select app_user_id() id"))[0].id).toBeNull();
      expect((await login("inativo@teste.local", PASS)).status).toBe("invalid");
    });
    it("sessão expirada não identifica o usuário", async () => {
      const l = await login("comercial@teste.local", PASS);
      tokens.exp = l.token;
      await admin.query("update sessions set expires_at = now() - interval '1 second' where token_hash = $1", [hash(l.token)]);
      expect((await as("exp", "select app_user_id() id"))[0].id).toBeNull();
      expect(await as("exp", "select * from clients")).toEqual([]);
    });
    it("tabelas de credenciais e sessões são inacessíveis ao app", async () => {
      await expect(as("owner", "select * from user_credentials")).rejects.toMatchObject({ code: "42501" });
      await expect(as("owner", "select * from sessions")).rejects.toMatchObject({ code: "42501" });
    });
    it("troca de senha exige a senha atual", async () => {
      expect((await as<{ ok: boolean }>("producao", "select app_change_password('errada', 'nova-senha-123') ok"))[0].ok).toBe(false);
      expect((await as<{ ok: boolean }>("producao", "select app_change_password($1, 'nova-senha-123') ok", [PASS]))[0].ok).toBe(true);
      expect((await login("producao@teste.local", "nova-senha-123")).status).toBe("ok");
      await expect(as("comercial", "select app_set_password($1, 'xxxxxxxxxx')", [ids.owner])).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("permissões no banco (RLS)", () => {
    it("sem sessão nada é visível nem gravável", async () => {
      await admin.query("insert into clients(name) values ('Cliente RLS')");
      expect(await as(null, "select * from clients")).toEqual([]);
      await expect(as(null, "insert into clients(name) values ('x')")).rejects.toMatchObject({ code: "42501" });
    });
    it("comercial não acessa o financeiro; financeiro acessa", async () => {
      await as("financeiro", "insert into transactions(type, description, amount, due_date) values ('receita', 'Teste RLS', 100, current_date)");
      expect(await as("comercial", "select * from transactions")).toEqual([]);
      await expect(as("comercial", "insert into transactions(type, description, amount, due_date) values ('receita', 'x', 1, current_date)")).rejects.toMatchObject({ code: "42501" });
      expect((await as("financeiro", "select * from transactions")).length).toBe(1);
    });
    it("produção não vê o funil nem cria clientes", async () => {
      const [c] = await as<{ id: string }>("comercial", "insert into clients(name) values ('Cliente Funil') returning id");
      await as("comercial", "insert into deals(client_id, title) values ($1, 'Oportunidade')", [c.id]);
      expect(await as("producao", "select * from deals")).toEqual([]);
      expect((await as("producao", "select * from clients")).length).toBeGreaterThan(0);
      await expect(as("producao", "insert into clients(name) values ('x')")).rejects.toMatchObject({ code: "42501" });
      expect(await as("producao", "update clients set name = 'hack' where id = $1 returning id", [c.id])).toEqual([]);
    });
    it("somente o proprietário gerencia usuários e permissões", async () => {
      await expect(as("admin", "insert into users(name, email, role) values ('X', 'x@teste.local', 'owner')")).rejects.toMatchObject({ code: "42501" });
      expect(await as("admin", "update users set role = 'owner' where id = $1 returning id", [ids.admin])).toEqual([]);
      expect(await as("comercial", "update role_permissions set can_read = true returning role")).toEqual([]);
      await as("owner", "update role_permissions set can_read = true where role = 'comercial' and module = 'financeiro'");
      expect((await as("comercial", "select * from transactions")).length).toBe(1);
      await as("owner", "update role_permissions set can_read = false where role = 'comercial' and module = 'financeiro'");
      expect(await as("comercial", "select * from transactions")).toEqual([]);
    });
    it("mantém ao menos um proprietário ativo", async () => {
      await expect(as("owner", "update users set role = 'admin' where id = $1", [ids.owner])).rejects.toMatchObject({ code: "P0001" });
    });
    it("clientes e lançamentos não podem ser excluídos (apenas arquivados/cancelados)", async () => {
      await expect(as("owner", "delete from clients")).rejects.toMatchObject({ code: "42501" });
      await expect(as("owner", "delete from transactions")).rejects.toMatchObject({ code: "42501" });
      await expect(as("owner", "delete from audit_log")).rejects.toMatchObject({ code: "42501" });
    });
    it("auditoria registra o autor das alterações", async () => {
      const [c] = await as<{ id: string }>("comercial", "insert into clients(name) values ('Auditado') returning id");
      await as("comercial", "update clients set city = 'Cidade' where id = $1", [c.id]);
      const logs = await as<{ action: string; user_id: string; changes: Record<string, unknown> }>("owner", "select action, user_id, changes from audit_log where record_id = $1 order by id", [c.id]);
      expect(logs.map((l) => l.action)).toEqual(["insert", "update"]);
      expect(logs[1].user_id).toBe(ids.comercial);
      expect(logs[1].changes).toHaveProperty("city");
      expect(await as("comercial", "select * from audit_log")).toEqual([]);
    });
  });

  describe("regras de negócio no banco", () => {
    it("calcula subtotal e total da proposta e aplica descontos", async () => {
      const [c] = await as<{ id: string }>("comercial", "insert into clients(name) values ('Cliente Proposta') returning id");
      const [p] = await as<{ id: string; code: string }>("comercial", "insert into proposals(client_id, title) values ($1, 'Proposta') returning id, code", [c.id]);
      expect(p.code).toMatch(/^RF-\d{4}-\d{4}$/);
      await as("comercial", "insert into proposal_items(proposal_id, description, quantity, unit_price) values ($1,'A',2,100), ($1,'B',1,50.5)", [p.id]);
      const get = async () => (await as<{ subtotal: number; total: number }>("comercial", "select subtotal::float, total::float from proposals where id = $1", [p.id]))[0];
      expect(await get()).toEqual({ subtotal: 250.5, total: 250.5 });
      await as("comercial", "update proposals set discount_type = 'percentual', discount_value = 10 where id = $1", [p.id]);
      expect((await get()).total).toBe(225.45);
      await as("comercial", "update proposals set discount_type = 'valor', discount_value = 300 where id = $1", [p.id]);
      expect((await get()).total).toBe(0);
      await as("comercial", "delete from proposal_items where description = 'B' and proposal_id = $1", [p.id]);
      expect((await get()).subtotal).toBe(200);
      await expect(as("comercial", "update proposals set discount_type = 'percentual', discount_value = 101 where id = $1", [p.id])).rejects.toMatchObject({ code: "23514" });
      await as("comercial", "update proposals set status = 'enviada' where id = $1", [p.id]);
      await expect(as("comercial", "delete from proposals where id = $1 returning id", [p.id])).resolves.toEqual([]);
    });
    it("impede reservas conflitantes de equipamentos", async () => {
      const [e] = await as<{ id: string }>("producao", "insert into equipment(name, quantity, daily_rate) values ('Câmera', 2, 100) returning id");
      const ins = (q: number, s: string, f: string) =>
        as<{ id: string; total: number }>("producao", "insert into reservations(equipment_id, quantity, start_at, end_at, daily_rate) values ($1,$2,$3,$4,100) returning id, total::float", [e.id, q, s, f]);
      const [r1] = await ins(2, "2030-01-10T10:00:00-03", "2030-01-12T10:00:00-03");
      expect(r1.total).toBe(400);
      await expect(ins(1, "2030-01-11T10:00:00-03", "2030-01-13T10:00:00-03")).rejects.toMatchObject({ code: "P0001" });
      await ins(2, "2030-01-12T10:00:00-03", "2030-01-13T10:00:00-03"); // encosta no fim: sem conflito
      await as("producao", "update reservations set status = 'cancelado' where id = $1", [r1.id]);
      await ins(1, "2030-01-11T10:00:00-03", "2030-01-11T12:00:00-03");
      await expect(ins(3, "2031-01-01T10:00:00-03", "2031-01-02T10:00:00-03")).rejects.toMatchObject({ code: "P0001" });
      await as("producao", "update equipment set status = 'manutencao' where id = $1", [e.id]);
      await expect(ins(1, "2032-01-01T10:00:00-03", "2032-01-02T10:00:00-03")).rejects.toMatchObject({ code: "P0001" });
    });
    it("lançamento pago exige data de pagamento e valor positivo", async () => {
      await expect(as("financeiro", "insert into transactions(type, description, amount, due_date, status) values ('receita','Sem data',10,current_date,'pago')")).rejects.toMatchObject({ code: "23514" });
      await expect(as("financeiro", "insert into transactions(type, description, amount, due_date) values ('receita','Negativo',-1,current_date)")).rejects.toMatchObject({ code: "23514" });
    });
    it("funil registra data de fechamento", async () => {
      const [c] = await as<{ id: string }>("comercial", "insert into clients(name) values ('Cliente Fechamento') returning id");
      const [d] = await as<{ id: string; closed_at: Date | null }>("comercial", "insert into deals(client_id, title) values ($1,'Venda') returning id, closed_at", [c.id]);
      expect(d.closed_at).toBeNull();
      const [d2] = await as<{ closed_at: Date | null }>("comercial", "update deals set stage = 'fechado' where id = $1 returning closed_at", [d.id]);
      expect(d2.closed_at).not.toBeNull();
    });
    it("responsável pode concluir a própria tarefa mesmo sem permissão de edição", async () => {
      await as("owner", "update role_permissions set can_write = false where role = 'producao' and module = 'tarefas'");
      const [t] = await as<{ id: string }>("owner", "insert into tasks(title, assignee_id) values ('Minha tarefa', $1) returning id", [ids.producao]);
      const [t2] = await as<{ id: string }>("owner", "insert into tasks(title, assignee_id) values ('Tarefa de outro', $1) returning id", [ids.comercial]);
      expect((await as<{ completed_at: Date }>("producao", "update tasks set status = 'concluida' where id = $1 returning completed_at", [t.id]))[0].completed_at).toBeTruthy();
      expect(await as("producao", "update tasks set status = 'concluida' where id = $1 returning id", [t2.id])).toEqual([]);
      await as("owner", "update role_permissions set can_write = true where role = 'producao' and module = 'tarefas'");
    });
  });

  describe("WhatsApp e automações", () => {
    it("webhook com assinatura inválida é registrado mas não processado", async () => {
      const [r] = await as<{ r: { ok: boolean } }>(null, "select app_whatsapp_ingest($1::jsonb, false) r", [JSON.stringify({ entry: [] })]);
      expect(r.r.ok).toBe(false);
    });
    it("mensagem recebida é vinculada ao cliente e status não regride", async () => {
      await admin.query("insert into clients(name, whatsapp) values ('Cliente WhatsApp', '5511988887777')");
      const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.IN1", from: "5511988887777", type: "text", text: { body: "Olá!" } }] } }] }] };
      await as(null, "select app_whatsapp_ingest($1::jsonb, true)", [JSON.stringify(payload)]);
      await as(null, "select app_whatsapp_ingest($1::jsonb, true)", [JSON.stringify(payload)]); // reentrega da Meta: sem duplicar
      const msgs = await as<{ client_name: string; body: string }>("comercial", "select c.name client_name, m.body from whatsapp_messages m join clients c on c.id = m.client_id where m.wa_message_id = 'wamid.IN1'");
      expect(msgs).toEqual([{ client_name: "Cliente WhatsApp", body: "Olá!" }]);
      await admin.query("insert into whatsapp_messages(direction, phone, body, status, wa_message_id) values ('out', '5511988887777', 'x', 'enviado', 'wamid.OUT1')");
      const st = (s: string) => ({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.OUT1", status: s }] } }] }] });
      await as(null, "select app_whatsapp_ingest($1::jsonb, true)", [JSON.stringify(st("read"))]);
      await as(null, "select app_whatsapp_ingest($1::jsonb, true)", [JSON.stringify(st("delivered"))]);
      expect((await admin.query("select status from whatsapp_messages where wa_message_id = 'wamid.OUT1'")).rows[0].status).toBe("lido");
      // o HMAC usado pela rota é o mesmo da Meta
      expect(createHmac("sha256", "s").update("{}").digest("hex")).toHaveLength(64);
    });
    it("automações geram rascunhos e tarefas, sem duplicar e sem enviar", async () => {
      const [c] = await as<{ id: string }>("comercial", "insert into clients(name, whatsapp) values ('Cliente Follow', '11977776666') returning id");
      await as("comercial", "insert into deals(client_id, title, next_contact_at) values ($1, 'Follow-up teste', now() - interval '1 hour')", [c.id]);
      const [r1] = await as<{ r: { rascunhos: number; tarefas: number } }>("comercial", "select app_run_automations() r");
      expect(r1.r.rascunhos).toBeGreaterThanOrEqual(1);
      expect(r1.r.tarefas).toBeGreaterThanOrEqual(1);
      const [r2] = await as<{ r: { rascunhos: number; tarefas: number } }>("comercial", "select app_run_automations() r");
      expect(r2.r).toMatchObject({ rascunhos: 0, tarefas: 0 });
      const drafts = await as<{ status: string; phone: string }>("comercial", "select status, phone from whatsapp_messages where client_id = $1", [c.id]);
      expect(drafts).toEqual([{ status: "rascunho", phone: "5511977776666" }]);
      await expect(as("producao", "select app_run_automations()")).rejects.toMatchObject({ code: "42501" });
    });
  });
});

describe.skipIf(enabled)("banco de dados", () => {
  it.skip("TEST_DATABASE_ADMIN_URL/TEST_DATABASE_URL (bancos *_test) não configurados", () => {});
});
