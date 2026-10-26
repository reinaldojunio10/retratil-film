"use client";

import { startTransition, useActionState } from "react";
import { savePermissions } from "./actions";

const ROLES = [["admin", "Administrador"], ["comercial", "Comercial"], ["producao", "Produção"], ["financeiro", "Financeiro"]];

export function PermissionsForm({ owner, modules, perms }: { owner: boolean; modules: { key: string; label: string }[]; perms: { role: string; module: string; can_read: boolean; can_write: boolean }[] }) {
  const [state, action, pending] = useActionState(savePermissions, {});
  const get = (role: string, m: string) => perms.find((p) => p.role === role && p.module === m);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <div className="rtable overflow-x-auto">
        <table className="w-full divide-y divide-line text-sm">
          <thead className="bg-soft/60">
            <tr><th className="th px-3">Módulo</th><th className="th px-2 text-center normal-case">Proprietário</th>{ROLES.map(([k, l]) => <th key={k} className="th px-2 text-center normal-case">{l}<br /><span className="font-normal">ver · editar</span></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {modules.map((m) => (
              <tr key={m.key}>
                <td className="td px-3 font-medium">{m.label}</td>
                <td className="td px-2 text-center text-xs text-stone-500" data-label="Proprietário">total</td>
                {ROLES.map(([r]) => {
                  const p = get(r, m.key);
                  return (
                    <td key={r} className="td whitespace-nowrap px-2 text-center" data-label={ROLES.find(([k]) => k === r)![1] + " (ver · editar)"}>
                      <input type="checkbox" name={`${r}:${m.key}:r`} defaultChecked={p?.can_read} disabled={!owner} aria-label={`${r} ver ${m.label}`} className="mr-4 h-5 w-5 accent-black" />
                      <input type="checkbox" name={`${r}:${m.key}:w`} defaultChecked={p?.can_write} disabled={!owner || m.key === "usuarios"} aria-label={`${r} editar ${m.label}`} className="h-5 w-5 accent-black" />
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
