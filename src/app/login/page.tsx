import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-white text-xs font-black tracking-tighter text-ink">RF</div>
          <span className="font-semibold">Retrátil Film</span>
        </div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Do primeiro contato à entrega final, toda a produção em um só lugar.</p>
          <p className="mt-4 text-sm text-stone-400">CRM · Propostas · Contratos · Produções · Financeiro · Equipamentos</p>
        </div>
        <p className="text-xs text-stone-500">Sistema de Gestão Audiovisual</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-ink text-xs font-black tracking-tighter text-white">RF</div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-stone-500">Acesse com seu e-mail e senha.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
