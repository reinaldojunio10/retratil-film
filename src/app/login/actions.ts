"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export async function loginAction(_: { error: string }, fd: FormData): Promise<{ error: string }> {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!email || !password || email.length > 160 || password.length > 200) return { error: "Informe e-mail e senha." };
  let status: string;
  try {
    status = await login(email, password);
  } catch (e) {
    console.error("[login]", (e as Error).message);
    return { error: "Serviço indisponível. Tente novamente em instantes." };
  }
  if (status === "locked") return { error: "Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente." };
  if (status !== "ok") return { error: "E-mail ou senha incorretos." };
  redirect("/");
}
