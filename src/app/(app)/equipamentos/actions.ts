"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { equipmentSchema, parse, reservationSchema } from "@/lib/validation";

const ecols = "name, category, brand, model, serial_number, quantity, daily_rate, replacement_value, status, notes";
const evals = (d: ReturnType<typeof equipmentSchema.parse>) => [d.name, d.category, d.brand, d.model, d.serial_number, d.quantity, d.daily_rate, d.replacement_value, d.status, d.notes];

export async function saveEquipment(id: string | null, _: FormState, fd: FormData) {
  return runForm("equipamentos", async (db) => {
    const d = parse(equipmentSchema, fd);
    if (id) {
      await db.exec(`update equipment set (${ecols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) where id = $11`, [...evals(d), id]);
      return { message: "Equipamento atualizado." };
    }
    const r = await db.one<{ id: string }>(`insert into equipment (${ecols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`, evals(d));
    return { redirect: `/equipamentos/${r!.id}`, message: "Equipamento cadastrado." };
  });
}

const rcols = "equipment_id, quantity, client_id, project_id, start_at, end_at, daily_rate, conditions, notes";

export async function saveReservation(id: string | null, _: FormState, fd: FormData) {
  return runForm("equipamentos", async (db) => {
    const d = parse(reservationSchema, fd);
    const rate = d.daily_rate ?? (await db.one<{ daily_rate: number }>("select daily_rate from equipment where id = $1", [d.equipment_id]))?.daily_rate ?? 0;
    const v = [d.equipment_id, d.quantity, d.client_id, d.project_id, d.start_at, d.end_at, rate, d.conditions, d.notes];
    if (id) {
      const n = await db.exec(`update reservations set (${rcols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9) where id = $10 and status in ('reservado','retirado')`, [...v, id]);
      if (!n) throw Object.assign(new Error("Reservas devolvidas ou canceladas não podem ser alteradas."), { code: "P0001" });
      return { message: "Reserva atualizada." };
    }
    const r = await db.one<{ id: string }>(`insert into reservations (${rcols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, v);
    return { redirect: `/equipamentos/reservas/${r!.id}`, message: "Reserva criada." };
  });
}

const FLOW: Record<string, string[]> = { reservado: ["retirado", "cancelado"], retirado: ["devolvido"], devolvido: [], cancelado: [] };

export async function setReservationStatus(fd: FormData) {
  await runButton("equipamentos", async (db) => {
    const id = str(fd, "id");
    const status = str(fd, "status");
    const r = await db.one<{ status: string }>("select status from reservations where id = $1", [id]);
    if (!r || !FLOW[r.status]?.includes(status)) throw Object.assign(new Error("Mudança de situação não permitida."), { code: "P0001" });
    await db.exec("update reservations set status = $1 where id = $2", [status, id]);
    return { message: { retirado: "Retirada registrada.", devolvido: "Devolução registrada.", cancelado: "Reserva cancelada." }[status] };
  });
}

export async function chargeReservation(fd: FormData) {
  await runButton("financeiro", async (db) => {
    const r = await db.one<{ id: string; total: number; client_id: string | null; project_id: string | null; name: string; start_at: Date }>(
      "select r.id, r.total, r.client_id, r.project_id, e.name, r.start_at from reservations r join equipment e on e.id = r.equipment_id where r.id = $1", [str(fd, "id")]);
    if (!r || !r.client_id || r.total <= 0) throw Object.assign(new Error("A reserva precisa ter cliente e valor para gerar cobrança."), { code: "P0001" });
    const desc = `Locação: ${r.name} (reserva ${r.id.slice(0, 8)})`;
    if (await db.one("select 1 from transactions where description = $1 and status <> 'cancelado'", [desc])) throw Object.assign(new Error("Cobrança já lançada."), { code: "P0001" });
    await db.exec("insert into transactions(type, description, category, amount, due_date, client_id, project_id) values ('receita',$1,'locacao',$2,current_date,$3,$4)", [desc, r.total, r.client_id, r.project_id]);
    return { message: "Conta a receber da locação criada." };
  });
}
