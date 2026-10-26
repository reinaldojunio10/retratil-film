"use server";

import { z } from "zod";
import type { FormState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage, withSession } from "@/lib/db";
import { parse, passwordSchema, ValidationError } from "@/lib/validation";

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  try {
    const d = parse(z.object({ current: z.string().min(1, "Informe a senha atual"), password: passwordSchema, confirm: z.string() }), fd);
    if (d.password !== d.confirm) throw new ValidationError({ confirm: "As senhas não conferem" });
    const r = await withSession(user.tokenHash, (db) => db.one<{ ok: boolean }>("select app_change_password($1, $2) ok", [d.current, d.password]));
    if (!r?.ok) return { error: "Senha atual incorreta.", fieldErrors: { current: "Senha atual incorreta" } };
    return { ok: true, message: "Senha alterada. Outras sessões foram encerradas." };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors };
    return { error: dbErrorMessage(e) };
  }
}
