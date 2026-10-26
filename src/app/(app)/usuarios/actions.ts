"use server";

import { z } from "zod";
import { runForm, type FormState } from "@/lib/actions";
import { MODULES } from "@/lib/permissions";
import { normalizePhone } from "@/lib/format";
import { parse, passwordSchema, userSchema, ValidationError } from "@/lib/validation";

const ownerOnly = (role: string) => {
  if (role !== "owner") throw Object.assign(new Error("Apenas o proprietário pode gerenciar usuários e permissões."), { code: "42501" });
};

export async function createUser(_: FormState, fd: FormData) {
  return runForm("usuarios", async (db, user) => {
    ownerOnly(user.role);
    const d = parse(userSchema.extend({ password: passwordSchema }), fd);
    const r = await db.one<{ id: string }>("insert into users(name, email, phone, role, active) values ($1, lower($2), $3, $4, $5) returning id", [d.name, d.email, normalizePhone(d.phone), d.role, d.active]);
    await db.exec("select app_set_password($1, $2)", [r!.id, d.password]);
    return { redirect: "/usuarios", message: "Usuário criado. Informe a senha inicial a ele por um canal seguro." };
  });
}

export async function updateUser(id: string, _: FormState, fd: FormData) {
  return runForm("usuarios", async (db, user) => {
    ownerOnly(user.role);
    const d = parse(userSchema, fd);
    await db.exec("update users set name = $1, email = lower($2), phone = $3, role = $4, active = $5 where id = $6", [d.name, d.email, normalizePhone(d.phone), d.role, d.active, id]);
    return { message: "Usuário atualizado." };
  });
}

export async function resetPassword(id: string, _: FormState, fd: FormData) {
  return runForm("usuarios", async (db, user) => {
    ownerOnly(user.role);
    const d = parse(z.object({ password: passwordSchema, confirm: z.string() }), fd);
    if (d.password !== d.confirm) throw new ValidationError({ confirm: "As senhas não conferem" });
    await db.exec("select app_set_password($1, $2)", [id, d.password]);
    return { message: "Senha redefinida. As sessões abertas desse usuário foram encerradas." };
  });
}

export async function savePermissions(_: FormState, fd: FormData) {
  return runForm("usuarios", async (db, user) => {
    ownerOnly(user.role);
    for (const role of ["admin", "comercial", "producao", "financeiro"]) {
      for (const m of MODULES) {
        const w = fd.get(`${role}:${m.key}:w`) === "on";
        const r = w || fd.get(`${role}:${m.key}:r`) === "on";
        await db.exec(
          "insert into role_permissions(role, module, can_read, can_write) values ($1,$2,$3,$4) on conflict (role, module) do update set can_read = excluded.can_read, can_write = excluded.can_write",
          [role, m.key, r, w],
        );
      }
    }
    return { message: "Permissões salvas. Valem imediatamente, inclusive no banco de dados." };
  });
}
