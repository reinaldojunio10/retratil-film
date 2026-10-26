"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { DEAL_STAGE_KEYS, dealSchema, parse } from "@/lib/validation";

const cols = "client_id, title, stage, value, service_id, owner_id, next_contact_at, expected_close, lost_reason, notes";
const vals = (d: ReturnType<typeof dealSchema.parse>) => [d.client_id, d.title, d.stage, d.value, d.service_id, d.owner_id, d.next_contact_at, d.expected_close, d.lost_reason, d.notes];

export async function createDeal(_: FormState, fd: FormData) {
  return runForm("funil", async (db, user) => {
    const d = parse(dealSchema, fd);
    if (!d.owner_id) d.owner_id = user.id;
    const r = await db.one<{ id: string }>(`insert into deals (${cols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`, vals(d));
    return { redirect: `/funil/${r!.id}`, message: "Oportunidade criada." };
  });
}

export async function updateDeal(id: string, _: FormState, fd: FormData) {
  return runForm("funil", async (db) => {
    const d = parse(dealSchema, fd);
    await db.exec(`update deals set (${cols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) where id = $11`, [...vals(d), id]);
    return { message: "Oportunidade atualizada." };
  });
}

export async function moveDeal(fd: FormData) {
  const stage = str(fd, "stage");
  await runButton("funil", async (db) => {
    if (!(DEAL_STAGE_KEYS as readonly string[]).includes(stage)) throw new Error("etapa inválida");
    if (stage === "perdido") return { redirect: `/funil/${str(fd, "id")}?perder=1`, message: "Informe o motivo da perda e salve." };
    await db.exec("update deals set stage = $1 where id = $2", [stage, str(fd, "id")]);
  });
}
