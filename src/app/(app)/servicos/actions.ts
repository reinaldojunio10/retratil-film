"use server";

import { runForm, type FormState } from "@/lib/actions";
import { parse, serviceSchema } from "@/lib/validation";

export async function saveService(id: string | null, _: FormState, fd: FormData) {
  return runForm("servicos", async (db) => {
    const d = parse(serviceSchema, fd);
    const v = [d.name, d.description, d.category, d.unit, d.base_price, d.active];
    if (id) {
      await db.exec("update services set (name, description, category, unit, base_price, active) = ($1,$2,$3,$4,$5,$6) where id = $7", [...v, id]);
      return { message: "Serviço atualizado." };
    }
    await db.exec("insert into services (name, description, category, unit, base_price, active) values ($1,$2,$3,$4,$5,$6)", v);
    return { redirect: "/servicos", message: "Serviço cadastrado." };
  });
}
