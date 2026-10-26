"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, { error: "" });
  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full" pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
