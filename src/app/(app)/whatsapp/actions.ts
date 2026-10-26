"use server";

import { z } from "zod";
import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { normalizePhone } from "@/lib/format";
import { optUuid, opt, parse, waTemplateSchema, ValidationError } from "@/lib/validation";
import { insideServiceWindow, sendViaCloudApi, waConfig } from "@/lib/whatsapp";
import type { Db } from "@/lib/db";

type Msg = { id: string; phone: string; body: string | null; status: string; template_id: string | null; template_params: string[] | null; client_id: string | null };

const err = (m: string) => Object.assign(new Error(m), { code: "P0001" });

async function deliver(db: Db, m: Msg): Promise<string> {
  const cfg = waConfig();
  if (m.status !== "rascunho" && m.status !== "falhou") throw err("Esta mensagem já foi processada.");
  if (cfg.mode === "disabled") throw err("Integração com WhatsApp não configurada. Defina as credenciais e o modo em variáveis de ambiente.");
  const tpl = m.template_id ? await db.one<{ name: string; language: string; approved: boolean; variables: number }>("select name, language, approved, variables from whatsapp_templates where id = $1", [m.template_id]) : null;
  if (!tpl) {
    const last = await db.one<{ at: Date | null }>("select max(created_at) at from whatsapp_messages where phone = $1 and direction = 'in'", [m.phone]);
    if (!insideServiceWindow(last?.at ?? null)) throw err("Fora da janela de 24h de atendimento: a Meta só permite iniciar conversa com um modelo aprovado.");
  } else if (!tpl.approved && cfg.mode === "live") {
    throw err("O modelo ainda não foi marcado como aprovado no WhatsApp Manager.");
  }
  if (cfg.mode === "test") {
    await db.exec("update whatsapp_messages set status = 'simulado', error = null where id = $1", [m.id]);
    return "Modo de teste: mensagem registrada como SIMULADA (nada foi enviado).";
  }
  await db.exec("update whatsapp_messages set status = 'enviando' where id = $1", [m.id]);
  const r = await sendViaCloudApi({
    to: m.phone,
    text: tpl ? undefined : m.body ?? "",
    template: tpl ? { name: tpl.name, language: tpl.language, params: (m.template_params ?? []).slice(0, tpl.variables) } : undefined,
  });
  if (r.ok) {
    await db.exec("update whatsapp_messages set status = 'enviado', wa_message_id = $2, error = null where id = $1", [m.id, r.id]);
    return "Mensagem enviada.";
  }
  await db.exec("update whatsapp_messages set status = 'falhou', error = $2 where id = $1", [m.id, r.error.slice(0, 500)]);
  return `Falha no envio: ${r.error}`;
}

const composeSchema = z.object({
  client_id: optUuid,
  phone: opt(30),
  template_id: optUuid,
  params: opt(500),
  body: opt(4096),
  send_now: z.preprocess((v) => v === "on", z.boolean()),
});

export async function composeMessage(_: FormState, fd: FormData) {
  return runForm("whatsapp", async (db) => {
    const d = parse(composeSchema, fd);
    let phone = normalizePhone(d.phone);
    if (!phone && d.client_id) {
      const c = await db.one<{ whatsapp: string | null; phone: string | null }>("select whatsapp, phone from clients where id = $1", [d.client_id]);
      phone = normalizePhone(c?.whatsapp ?? c?.phone);
    }
    if (!phone || phone.length < 12) throw new ValidationError({ phone: "Informe um número com DDD ou selecione um cliente com WhatsApp" });
    let body = d.body;
    const params = (d.params ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    if (d.template_id) {
      const t = await db.one<{ body_preview: string; variables: number }>("select body_preview, variables from whatsapp_templates where id = $1 and active", [d.template_id]);
      if (!t) throw new ValidationError({ template_id: "Modelo inválido" });
      if (params.length < t.variables) throw new ValidationError({ params: `Este modelo exige ${t.variables} variável(is), separadas por |` });
      body = params.reduce((s, p, i) => s.replaceAll(`{{${i + 1}}}`, p), t.body_preview);
    }
    if (!body) throw new ValidationError({ body: "Escreva a mensagem ou escolha um modelo" });
    const m = await db.one<Msg>(
      "insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source) values ($1,'out',$2,$3,$4,$5,'rascunho','manual') returning *",
      [d.client_id, phone, body, d.template_id, d.template_id ? JSON.stringify(params) : null],
    );
    if (!d.send_now) return { message: "Rascunho salvo." };
    try {
      return { message: await deliver(db, m!) };
    } catch (e) {
      // regra de envio violada: mantém o rascunho e informa o motivo
      if ((e as { code?: string }).code === "P0001") return { message: `Rascunho salvo, mas não enviado: ${(e as Error).message}` };
      throw e;
    }
  });
}

export async function sendDraft(fd: FormData) {
  await runButton("whatsapp", async (db) => {
    const m = await db.one<Msg>("select * from whatsapp_messages where id = $1 and direction = 'out'", [str(fd, "id")]);
    if (!m) throw err("Mensagem não encontrada.");
    return { message: await deliver(db, m) };
  });
}

export async function discardDraft(fd: FormData) {
  await runButton("whatsapp", async (db) => {
    const n = await db.exec("delete from whatsapp_messages where id = $1 and status = 'rascunho'", [str(fd, "id")]);
    if (!n) throw err("Somente rascunhos podem ser descartados.");
    return { message: "Rascunho descartado." };
  });
}

export async function runAutomations() {
  await runButton("whatsapp", async (db) => {
    const r = await db.one<{ r: { rascunhos: number; tarefas: number } }>("select app_run_automations() r");
    return { message: `Automações executadas: ${r!.r.rascunhos} rascunho(s) de mensagem e ${r!.r.tarefas} tarefa(s) criados. Nada foi enviado automaticamente.` };
  });
}

export async function saveWaTemplate(id: string | null, _: FormState, fd: FormData) {
  return runForm("whatsapp", async (db) => {
    const d = parse(waTemplateSchema, fd);
    const v = [d.name, d.language, d.category, d.purpose, d.body_preview, d.variables, d.approved, d.active];
    if (id) await db.exec("update whatsapp_templates set (name, language, category, purpose, body_preview, variables, approved, active) = ($1,$2,$3,$4,$5,$6,$7,$8) where id = $9", [...v, id]);
    else await db.exec("insert into whatsapp_templates(name, language, category, purpose, body_preview, variables, approved, active) values ($1,$2,$3,$4,$5,$6,$7,$8)", v);
    return id ? { message: "Modelo atualizado." } : { redirect: "/whatsapp/modelos", message: "Modelo cadastrado." };
  });
}
