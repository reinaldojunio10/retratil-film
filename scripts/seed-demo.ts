// Dados de DEMONSTRAÇÃO (is_demo = true, nomes com "(DEMO)"). Não são dados reais.
// Inserir: npm run db:demo      Remover: npm run db:demo -- --remove
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("Defina DATABASE_ADMIN_URL");
  const c = new Client({ connectionString: url, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  await c.connect();
  await c.query("begin");
  try {
    if (process.argv.includes("--remove")) {
      for (const t of ["reservations", "transactions", "tasks", "contracts", "proposals", "projects", "deals", "clients", "equipment"]) {
        const r = await c.query(`delete from ${t} where is_demo`);
        console.log(`${t}: ${r.rowCount} removido(s)`);
      }
      await c.query("commit");
      return;
    }
    if ((await c.query("select 1 from clients where is_demo limit 1")).rowCount) throw new Error("Dados de demonstração já existem.");
    const owner = (await c.query("select id from users where role = 'owner' order by created_at limit 1")).rows[0]?.id ?? null;
    const svc = async (name: string) => (await c.query("select id from services where name = $1", [name])).rows[0]?.id ?? null;
    const ins = async (sql: string, params: unknown[]) => (await c.query(sql + " returning id", params)).rows[0].id as string;

    const cl1 = await ins("insert into clients(name, company, whatsapp, email, city, state, source, owner_id, is_demo) values ('Banda Exemplo (DEMO)', 'Banda Exemplo', '5500900000001', 'demo1@exemplo.invalid', 'Cidade Demo', 'SP', 'instagram', $1, true)", [owner]);
    const cl2 = await ins("insert into clients(name, company, whatsapp, email, city, state, source, owner_id, is_demo) values ('Empresa Fictícia (DEMO)', 'Empresa Fictícia Ltda', '5500900000002', 'demo2@exemplo.invalid', 'Cidade Demo', 'SP', 'indicacao', $1, true)", [owner]);
    const cl3 = await ins("insert into clients(name, whatsapp, city, source, is_demo) values ('Artista Teste (DEMO)', '5500900000003', 'Cidade Demo', 'whatsapp', true)", []);
    await c.query("insert into client_interactions(client_id, kind, summary, user_id) values ($1, 'whatsapp', 'Contato de demonstração: pediu orçamento de videoclipe.', $2)", [cl1, owner]);

    const d1 = await ins("insert into deals(client_id, title, stage, value, service_id, owner_id, next_contact_at, is_demo) values ($1, 'Videoclipe single (DEMO)', 'negociacao', 8000, $2, $3, now() - interval '1 day', true)", [cl1, await svc("Videoclipe"), owner]);
    await ins("insert into deals(client_id, title, stage, value, service_id, owner_id, next_contact_at, is_demo) values ($1, 'Vídeo institucional (DEMO)', 'novo', 5000, $2, $3, now() + interval '2 days', true)", [cl2, await svc("Vídeo institucional para empresas"), owner]);
    await ins("insert into deals(client_id, title, stage, value, owner_id, is_demo) values ($1, 'Captação de show (DEMO)', 'fechado', 3500, $2, true)", [cl3, owner]);

    const p1 = await ins("insert into proposals(client_id, deal_id, title, payment_terms, valid_until, discount_type, discount_value, status, is_demo) values ($1, $2, 'Videoclipe single (DEMO)', '50% na assinatura e 50% na entrega.', current_date + 2, 'percentual', 5, 'rascunho', true)", [cl1, d1]);
    await c.query("insert into proposal_items(proposal_id, service_id, description, quantity, unit_price, position) values ($1, $2, 'Videoclipe — roteiro, direção, captação e edição (DEMO)', 1, 7000, 1), ($1, null, 'Diária extra de captação (DEMO)', 1, 1200, 2)", [p1, await svc("Videoclipe")]);
    await c.query("update proposals set status = 'enviada' where id = $1", [p1]);

    const pr1 = await ins("insert into projects(title, client_id, service_id, status, location, shoot_date, delivery_date, budget, manager_id, is_demo) values ('Captação de show (DEMO)', $1, $2, 'gravacao', 'Local fictício', now() + interval '3 days', current_date + 20, 3500, $3, true)", [cl3, await svc("Captação de show"), owner]);
    await c.query("insert into tasks(title, priority, due_at, assignee_id, project_id, client_id, is_demo) values ('Checklist de equipamentos (DEMO)', 'alta', now() + interval '1 day', $1, $2, $3, true), ('Enviar prévia ao cliente (DEMO)', 'media', now() - interval '1 day', $1, $2, $3, true)", [owner, pr1, cl3]);
    await c.query("insert into tasks(title, kind, priority, due_at, assignee_id, location, client_id, is_demo) values ('Reunião de briefing (DEMO)', 'compromisso', 'media', now() + interval '2 days', $1, 'Escritório', $2, true)", [owner, cl2]);

    await c.query(`insert into transactions(type, description, category, amount, due_date, status, paid_at, client_id, project_id, is_demo) values
      ('receita', 'Sinal captação de show (DEMO)', 'sinal', 1750, current_date - 5, 'pago', current_date - 5, $1, $2, true),
      ('receita', 'Saldo captação de show (DEMO)', 'servicos', 1750, current_date + 20, 'pendente', null, $1, $2, true),
      ('despesa', 'Freelancer câmera (DEMO)', 'equipe', 600, current_date + 3, 'pendente', null, null, $2, true),
      ('despesa', 'Assinatura de software (DEMO)', 'software', 120, current_date - 2, 'pendente', null, null, null, true)`, [cl3, pr1]);

    const e1 = await ins("insert into equipment(name, category, brand, model, quantity, daily_rate, is_demo) values ('Câmera cinema (DEMO)', 'camera', 'Marca', 'Modelo X', 2, 450, true)", []);
    await ins("insert into equipment(name, category, quantity, daily_rate, is_demo) values ('Kit de microfones sem fio (DEMO)', 'audio', 3, 120, true)", []);
    await ins("insert into equipment(name, category, quantity, daily_rate, status, is_demo) values ('Drone (DEMO)', 'drone', 1, 350, 'manutencao', true)", []);
    await c.query("insert into reservations(equipment_id, quantity, project_id, start_at, end_at, daily_rate, is_demo) values ($1, 1, $2, now() + interval '3 days', now() + interval '4 days', 0, true)", [e1, pr1]);

    await c.query("commit");
    console.log("Dados de demonstração inseridos (marcados como DEMO).");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
