"use client";

import { startTransition, useActionState } from "react";
import { savePermissions } from "./actions";

const ROLES = [["admin", "Administrador"], ["comercial", "Comercial"], ["producao", "Produção"], ["financeiro", "Financeiro"]];

export function PermissionsForm({ owner, modules, perms }: { owner: boolean; modules: { key: string; label: string }[]; perms: { role: string; module: string; can_read: boolean; can_write: boolean }[] }) {
  const [state, action, pending] = useActionState(savePermissions, {});
  const get = (role: string, m: string) => perms.find((p) => p.role === role && p.module === m);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-line text-sm">
          <thead className="bg-soft/60">
            <tr><th className="th">Módulo</th><th className="th text-center">Proprietário</th>{ROLES.map(([k, l]) => <th key={k} className="th text-center">{l}<br /><span className="font-normal normal-case">ver · editar</span></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {modules.map((m) => (
              <tr key={m.key}>
                <td className="td font-medium">{m.label}</td>
                <td className="td text-center text-xs text-stone-500">total</td>
                {ROLES.map(([r]) => {
                  const p = get(r, m.key);
                  return (
                    <td key={r} className="td text-center">
                      <input type="checkbox" name={`${r}:${m.key}:r`} defaultChecked={p?.can_read} disabled={!owner} aria-label={`${r} ver ${m.label}`} className="mr-3 h-4 w-4 accent-black" />
                      <input type="checkbox" name={`${r}:${m.key}:w`} defaultChecked={p?.can_write} disabled={!owner || m.key === "usuarios"} aria-label={`${r} editar ${m.label}`} className="h-4 w-4 accent-black" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {owner && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
          <button className="btn btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar permissões"}</button>
          {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
          {state.ok && <span role="status" className="text-sm text-emerald-700">{state.message}</span>}
          <span className="text-xs text-stone-500">“Editar” inclui “ver”. A gestão de usuários é exclusiva do proprietário.</span>
        </div>
      )}
    </form>
  );
}
