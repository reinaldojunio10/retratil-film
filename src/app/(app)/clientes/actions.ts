"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { normalizePhone } from "@/lib/format";
import { clientSchema, interactionSchema, parse } from "@/lib/validation";

const fields = "name, company, document, email, phone, whatsapp, address, city, state, source, owner_id, notes";
const values = (d: ReturnType<typeof clientSchema.parse>) => [
  d.name, d.company, d.document, d.email, d.phone, normalizePhone(d.whatsapp), d.address, d.city, d.state?.toUpperCase() ?? null, d.source, d.owner_id, d.notes,
];

export async function createClient(_: FormState, fd: FormData) {
  return runForm("clientes", async (db) => {
    const d = parse(clientSchema, fd);
    const r = await db.one<{ id: string }>(`insert into clients (${fields}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, values(d));
    return { redirect: `/clientes/${r!.id}`, message: "Cliente cadastrado." };
  });
}

export async function updateClient(id: string, _: FormState, fd: FormData) {
  return runForm("clientes", async (db) => {
    const d = parse(clientSchema, fd);
    const n = await db.exec(
      `update clients set (${fields}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) where id = $13`,
      [...values(d), id],
    );
    if (!n) throw new Error("not found");
    return { message: "Cliente atualizado." };
  });
}

export async function setArchived(fd: FormData) {
  const archive = str(fd, "archive") === "1";
  await runButton("clientes", async (db) => {
    await db.exec(`update clients set archived_at = ${archive ? "now()" : "null"} where id = $1`, [str(fd, "id")]);
    return { message: archive ? "Cliente arquivado." : "Cliente reativado." };
  });
}

export async function addInteraction(clientId: string, _: FormState, fd: FormData) {
  return runForm("clientes", async (db) => {
    const d = parse(interactionSchema, fd);
    await db.exec("insert into client_interactions(client_id, kind, summary, happened_at) values ($1,$2,$3,coalesce($4::timestamptz, now()))", [clientId, d.kind, d.summary, d.happened_at]);
    return { message: "Contato registrado." };
  });
}

export async function deleteInteraction(fd: FormData) {
  await runButton("clientes", async (db) => {
    await db.exec("delete from client_interactions where id = $1", [str(fd, "id")]);
    return { message: "Registro removido." };
  });
}
