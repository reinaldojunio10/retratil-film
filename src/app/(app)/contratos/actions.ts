"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { renderTemplate } from "@/lib/calc";
import { brl, fmtDate, fmtPhone, todayISO } from "@/lib/format";
import { contractCreateSchema, opt, parse, templateSchema } from "@/lib/validation";
import { z } from "zod";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function saveTemplate(id: string | null, _: FormState, fd: FormData) {
  return runForm("contratos", async (db) => {
    const d = parse(templateSchema, fd);
    if (id) {
      await db.exec("update contract_templates set name = $1, body = $2, active = $3 where id = $4", [d.name, d.body, d.active, id]);
      return { message: "Modelo atualizado." };
    }
    await db.exec("insert into contract_templates(name, body, active) values ($1,$2,$3)", [d.name, d.body, d.active]);
    return { redirect: "/contratos/modelos", message: "Modelo criado." };
  });
}

export async function createContract(_: FormState, fd: FormData) {
  return runForm("contratos", async (db) => {
    const d = parse(contractCreateSchema, fd);
    const tpl = await db.one<R>("select * from contract_templates where id = $1 and active", [d.template_id]);
    const client = await db.one<R>("select * from clients where id = $1", [d.client_id]);
    const company = await db.one<R>("select * from company_settings where id = 1");
    if (!tpl || !client) throw Object.assign(new Error("Modelo ou cliente inválido."), { code: "P0001" });
    const proposal = d.proposal_id ? await db.one<R>("select * from proposals where id = $1 and client_id = $2", [d.proposal_id, d.client_id]) : null;
    if (d.proposal_id && !proposal) throw Object.assign(new Error("A proposta selecionada não pertence a este cliente."), { code: "P0001" });
    const projectId = d.project_id ?? proposal?.project_id ?? null;
    const project = projectId ? await db.one<R>("select * from projects where id = $1", [projectId]) : null;
    const items = proposal ? await db.many<R>("select description, quantity, unit_price from proposal_items where proposal_id = $1 order by position", [proposal.id]) : [];
    const value = d.value ?? proposal?.total ?? 0;
    const body = renderTemplate(tpl.body, {
      contratante_nome: client.company ? `${client.name} (${client.company})` : client.name,
      contratante_documento: client.document,
      contratante_endereco: client.address,
      contratante_cidade: [client.city, client.state].filter(Boolean).join("/"),
      contratante_email: client.email,
      contratante_telefone: client.whatsapp || client.phone ? fmtPhone(client.whatsapp ?? client.phone) : null,
      contratada_nome: company?.legal_name,
      contratada_documento: company?.document,
      contratada_endereco: company?.address,
      contratada_cidade: [company?.city, company?.state].filter(Boolean).join("/"),
      projeto: project?.title ?? proposal?.title ?? d.title,
      servicos: items.length ? items.map((i) => `- ${i.description} (${String(i.quantity).replace(".", ",")} x ${brl(i.unit_price)})`).join("\n") : null,
      local: d.location ?? project?.location,
      data_inicio: fmtDate(d.start_date ?? project?.shoot_date ?? null).replace("—", "") || null,
      data_fim: fmtDate(d.end_date ?? project?.delivery_date ?? null).replace("—", "") || null,
      valor_total: brl(value),
      condicoes_pagamento: d.payment_terms ?? proposal?.payment_terms,
      data_atual: fmtDate(todayISO()),
    });
    const r = await db.one<{ id: string }>(
      "insert into contracts(client_id, project_id, proposal_id, template_id, title, body, value, start_date, end_date) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      [d.client_id, projectId, proposal?.id ?? null, tpl.id, d.title, body, value, d.start_date, d.end_date],
    );
    return { redirect: `/contratos/${r!.id}`, message: "Contrato gerado. Revise os campos marcados com ________." };
  });
}

export async function updateContractBody(id: string, _: FormState, fd: FormData) {
  return runForm("contratos", async (db) => {
    const d = parse(z.object({ title: z.string().trim().min(2).max(160), body: z.string().trim().min(10, "Texto muito curto").max(100000) }), fd);
    const n = await db.exec("update contracts set title = $1, body = $2 where id = $3 and status = 'rascunho'", [d.title, d.body, id]);
    if (!n) throw Object.assign(new Error("Somente contratos em rascunho podem ser editados."), { code: "P0001" });
    return { message: "Contrato atualizado." };
  });
}

const TRANSITIONS: Record<string, string[]> = { rascunho: ["emitido", "cancelado"], emitido: ["assinado_manual", "cancelado", "rascunho"], assinado_manual: ["cancelado"], cancelado: [] };

export async function setContractStatus(fd: FormData) {
  await runButton("contratos", async (db) => {
    const id = str(fd, "id");
    const status = str(fd, "status");
    const note = parse(z.object({ note: opt(500) }), fd).note;
    const c = await db.one<{ status: string }>("select status from contracts where id = $1", [id]);
    if (!c || !TRANSITIONS[c.status]?.includes(status)) throw Object.assign(new Error("Mudança de situação não permitida."), { code: "P0001" });
    await db.exec("update contracts set status = $1, signed_note = coalesce($3, signed_note) where id = $2", [status, id, note]);
    return { message: "Situação do contrato atualizada." };
  });
}

export async function deleteContract(fd: FormData) {
  await runButton("contratos", async (db) => {
    const n = await db.exec("delete from contracts where id = $1 and status = 'rascunho'", [str(fd, "id")]);
    if (!n) throw Object.assign(new Error("Apenas rascunhos podem ser excluídos."), { code: "P0001" });
    return { redirect: "/contratos", message: "Rascunho excluído." };
  });
}
