import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { withSession, dbErrorMessage, type Db } from "./db";
import type { Module, SessionUser } from "./permissions";
import { ValidationError } from "./validation";

export type FormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; ts?: number };
export type ActionResult = { redirect?: string; message?: string } | void;
type Fn = (db: Db, user: SessionUser) => Promise<ActionResult>;

function errorMessage(e: unknown) {
  if (e instanceof ValidationError) return e.message;
  return dbErrorMessage(e);
}

async function flash(message: string, kind: "ok" | "erro") {
  (await cookies()).set("rf_flash", encodeURIComponent(JSON.stringify({ message, kind })), { path: "/", maxAge: 30, sameSite: "lax" });
}

/** Para formulários com useActionState: valida permissão de escrita, executa e trata erros. */
export async function runForm(module: Module, fn: Fn): Promise<FormState> {
  const user = await requireUser(module, true);
  let result: ActionResult;
  try {
    result = await withSession(user.tokenHash, (db) => fn(db, user));
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors, ts: Date.now() };
    return { error: errorMessage(e), ts: Date.now() };
  }
  revalidatePath("/", "layout");
  if (result?.redirect) {
    if (result.message) await flash(result.message, "ok");
    redirect(result.redirect);
  }
  return { ok: true, message: result?.message ?? "Salvo com sucesso.", ts: Date.now() };
}

/** Para botões simples (<form action>): resultado exibido via aviso (toast). */
export async function runButton(module: Module, fn: Fn, write = true): Promise<void> {
  const user = await requireUser(module, write);
  let result: ActionResult;
  try {
    result = await withSession(user.tokenHash, (db) => fn(db, user));
  } catch (e) {
    await flash(errorMessage(e), "erro");
    revalidatePath("/", "layout");
    return;
  }
  if (result?.message) await flash(result.message, "ok");
  revalidatePath("/", "layout");
  if (result?.redirect) redirect(result.redirect);
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
