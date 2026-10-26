"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { parse, transactionSchema } from "@/lib/validation";

const cols = "type, description, category, amount, due_date, status, paid_at, payment_method, client_id, project_id, notes";
const vals = (d: ReturnType<typeof transactionSchema.parse>) => [d.type, d.description, d.category, d.amount, d.due_date, d.status, d.paid_at, d.payment_method, d.client_id, d.project_id, d.notes];

export async function createTx(_: FormState, fd: FormData) {
  return runForm("financeiro", async (db) => {
    const d = parse(transactionSchema, fd);
    await db.exec(`insert into transactions (${cols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, vals(d));
    return { redirect: "/financeiro", message: "Lançamento registrado." };
  });
}

export async function updateTx(id: string, _: FormState, fd: FormData) {
  return runForm("financeiro", async (db) => {
    const d = parse(transactionSchema, fd);
    await db.exec(`update transactions set (${cols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) where id = $12`, [...vals(d), id]);
    return { message: "Lançamento atualizado." };
  });
}

export async function setTxStatus(fd: FormData) {
  const status = str(fd, "status");
  await runButton("financeiro", async (db) => {
    if (!["pago", "pendente", "cancelado"].includes(status)) throw new Error("status inválido");
    await db.exec("update transactions set status = $1, paid_at = $2 where id = $3", [status, status === "pago" ? todayISO() : null, str(fd, "id")]);
    return { message: status === "pago" ? "Marcado como pago." : status === "cancelado" ? "Lançamento cancelado." : "Lançamento reaberto." };
  });
}
