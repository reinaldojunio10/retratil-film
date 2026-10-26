"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { parse, proposalItemSchema, proposalSchema, PROPOSAL_STATUS_KEYS, ValidationError } from "@/lib/validation";
import type { Db } from "@/lib/db";

const cols = "client_id, deal_id, project_id, title, discount_type, discount_value, payment_terms, valid_until, notes";
const vals = (d: ReturnType<typeof proposalSchema.parse>) => [d.client_id, d.deal_id, d.project_id, d.title, d.discount_type, d.discount_value, d.payment_terms, d.valid_until, d.notes];

async function assertEditable(db: Db, id: string) {
  const p = await db.one<{ status: string }>("select status from proposals where id = $1", [id]);
  if (!p) throw Object.assign(new Error("Proposta não encontrada."), { code: "P0001" });
  if (p.status !== "rascunho") throw Object.assign(new Error("Somente propostas em rascunho podem ser editadas. Volte para rascunho para alterar."), { code: "P0001" });
}

export async function createProposal(_: FormState, fd: FormData) {
  return runForm("propostas", async (db) => {
    const d = parse(proposalSchema, fd);
    const r = await db.one<{ id: string }>(`insert into proposals (${cols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, vals(d));
    return { redirect: `/propostas/${r!.id}`, message: "Proposta criada. Adicione os itens." };
  });
}

export async function updateProposal(id: string, _: FormState, fd: FormData) {
  return runForm("propostas", async (db) => {
    const d = parse(proposalSchema, fd);
    await assertEditable(db, id);
    await db.exec(`update proposals set (${cols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9) where id = $10`, [...vals(d), id]);
    return { message: "Proposta atualizada." };
  });
}

export async function addItem(proposalId: string, _: FormState, fd: FormData) {
  return runForm("propostas", async (db) => {
    const d = parse(proposalItemSchema, fd);
    await assertEditable(db, proposalId);
    let description = d.description;
    let price = d.unit_price;
    if (d.service_id) {
      const s = await db.one<{ name: string; description: string | null; base_price: number }>("select name, description, base_price from services where id = $1", [d.service_id]);
      if (s) {
        description ??= s.description ? `${s.name} — ${s.description}` : s.name;
        price ??= s.base_price;
      }
    }
    if (!description) throw new ValidationError({ description: "Informe a descrição ou selecione um serviço." });
    await db.exec(
      "insert into proposal_items(proposal_id, service_id, description, quantity, unit_price, position) values ($1,$2,$3,$4,$5,(select coalesce(max(position),0)+1 from proposal_items where proposal_id = $1))",
      [proposalId, d.service_id, description, d.quantity, price ?? 0],
    );
    return { message: "Item adicionado." };
  });
}

export async function removeItem(fd: FormData) {
  await runButton("propostas", async (db) => {
    await assertEditable(db, str(fd, "proposal_id"));
    await db.exec("delete from proposal_items where id = $1 and proposal_id = $2", [str(fd, "id"), str(fd, "proposal_id")]);
    return { message: "Item removido." };
  });
}

const TRANSITIONS: Record<string, string[]> = {
  rascunho: ["enviada", "cancelada"],
  enviada: ["aprovada", "recusada", "expirada", "rascunho", "cancelada"],
  aprovada: ["cancelada"],
  recusada: ["rascunho"],
  expirada: ["rascunho"],
  cancelada: ["rascunho"],
};

export async function setProposalStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  await runButton("propostas", async (db) => {
    if (!(PROPOSAL_STATUS_KEYS as readonly string[]).includes(status)) throw new Error("status inválido");
    const p = await db.one<{ status: string; deal_id: string | null; total: number; items: number }>(
      "select status, deal_id, total, (select count(*) from proposal_items where proposal_id = p.id) items from proposals p where id = $1", [id]);
    if (!p) throw Object.assign(new Error("Proposta não encontrada."), { code: "P0001" });
    if (!TRANSITIONS[p.status]?.includes(status)) throw Object.assign(new Error("Mudança de situação não permitida."), { code: "P0001" });
    if (status === "enviada" && p.items === 0) throw Object.assign(new Error("Adicione ao menos um item antes de enviar."), { code: "P0001" });
    await db.exec("update proposals set status = $1 where id = $2", [status, id]);
    // sincroniza o funil (sem efeito se o usuário não tiver permissão no funil — RLS)
    if (p.deal_id && status === "enviada") {
      await db.exec("update deals set stage = 'orcamento', value = $2 where id = $1 and stage in ('novo','contato','qualificacao','negociacao')", [p.deal_id, p.total]);
    }
    if (p.deal_id && status === "aprovada") {
      await db.exec("update deals set stage = 'fechado', value = $2 where id = $1 and stage <> 'fechado'", [p.deal_id, p.total]);
    }
    return { message: "Situação da proposta atualizada." };
  });
}

export async function deleteProposal(fd: FormData) {
  await runButton("propostas", async (db) => {
    const n = await db.exec("delete from proposals where id = $1 and status = 'rascunho'", [str(fd, "id")]);
    if (!n) throw Object.assign(new Error("Apenas rascunhos podem ser excluídos."), { code: "P0001" });
    return { redirect: "/propostas", message: "Rascunho excluído." };
  });
}

export async function createReceivable(fd: FormData) {
  await runButton("financeiro", async (db) => {
    const p = await db.one<{ id: string; code: string; title: string; total: number; client_id: string; project_id: string | null; status: string }>(
      "select id, code, title, total, client_id, project_id, status from proposals where id = $1", [str(fd, "id")]);
    if (!p || p.status !== "aprovada") throw Object.assign(new Error("A proposta precisa estar aprovada."), { code: "P0001" });
    const exists = await db.one("select 1 from transactions where proposal_id = $1 and status <> 'cancelado'", [p.id]);
    if (exists) throw Object.assign(new Error("Já existe conta a receber para esta proposta."), { code: "P0001" });
    await db.exec(
      "insert into transactions(type, description, category, amount, due_date, client_id, project_id, proposal_id) values ('receita', $1, 'servicos', $2, current_date + 7, $3, $4, $5)",
      [`${p.code} — ${p.title}`, p.total, p.client_id, p.project_id, p.id],
    );
    return { message: "Conta a receber criada (vencimento em 7 dias — ajuste no Financeiro)." };
  });
}

export async function createProjectFromProposal(fd: FormData) {
  await runButton("projetos", async (db) => {
    const p = await db.one<{ id: string; title: string; client_id: string; deal_id: string | null; project_id: string | null; total: number; service_id: string | null }>(
      "select p.id, p.title, p.client_id, p.deal_id, p.project_id, p.total, (select service_id from proposal_items where proposal_id = p.id and service_id is not null order by position limit 1) service_id from proposals p where id = $1",
      [str(fd, "id")]);
    if (!p) throw Object.assign(new Error("Proposta não encontrada."), { code: "P0001" });
    if (p.project_id) return { redirect: `/projetos/${p.project_id}` };
    const r = await db.one<{ id: string }>(
      "insert into projects(title, client_id, service_id, deal_id, budget) values ($1,$2,$3,$4,$5) returning id",
      [p.title, p.client_id, p.service_id, p.deal_id, p.total]);
    await db.exec("update proposals set project_id = $1 where id = $2", [r!.id, p.id]);
    return { redirect: `/projetos/${r!.id}`, message: "Produção criada a partir da proposta." };
  });
}
