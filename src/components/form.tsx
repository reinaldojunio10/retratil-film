"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { FormState } from "@/lib/actions";

export type Option = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "money" | "date" | "datetime-local" | "textarea" | "select" | "checkbox" | "password" | "hidden" | "url";
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  rows?: number;
  hint?: string;
  emptyLabel?: string;
};

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Salvando…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botão que pede confirmação antes de enviar o formulário. */
export function ConfirmButton({ children, message, className = "btn btn-danger btn-sm" }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function EntityForm({
  action, fields, defaults = {}, submitLabel = "Salvar", cancelHref, resetOnSuccess, compact,
}: {
  action: Action; fields: Field[]; defaults?: Record<string, unknown>; submitLabel?: string; cancelHref?: string; resetOnSuccess?: boolean; compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const fe = state.fieldErrors ?? {};

  return (
    // onSubmit manual: evita o reset automático do React 19, preservando os valores quando há erro
    <form
      ref={ref}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <div className={`grid grid-cols-1 gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const dv = defaults[f.name];
          const err = fe[f.name];
          const common = { id, name: f.name, "aria-invalid": err ? true : undefined, "aria-describedby": err ? `${id}-err` : undefined, required: f.required };
          if (f.type === "hidden") return <input key={f.name} type="hidden" name={f.name} defaultValue={String(dv ?? "")} />;
          const wide = f.full || f.type === "textarea";
          return (
            <div key={f.name} className={wide && !compact ? "sm:col-span-2" : ""}>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={f.name} defaultChecked={dv === undefined ? true : !!dv} className="h-4 w-4 accent-black" />
                  {f.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="label">
                    {f.label} {f.required && <span className="text-red-600">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea {...common} rows={f.rows ?? 4} className="input" defaultValue={String(dv ?? "")} placeholder={f.placeholder} />
                  ) : f.type === "select" ? (
                    <select {...common} className="input" defaultValue={String(dv ?? "")}>
                      {!f.required || f.emptyLabel ? <option value="">{f.emptyLabel ?? "—"}</option> : null}
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      {...common}
                      type={f.type === "money" ? "text" : f.type ?? "text"}
                      inputMode={f.type === "money" || f.type === "number" ? "decimal" : undefined}
                      className="input"
                      defaultValue={dv === null || dv === undefined ? "" : f.type === "money" ? String(dv).replace(".", ",") : String(dv)}
                      placeholder={f.placeholder ?? (f.type === "money" ? "0,00" : undefined)}
                      autoComplete={f.type === "password" ? "new-password" : undefined}
                    />
                  )}
                </>
              )}
              {f.hint && !err && <p className="mt-1 text-xs text-stone-500">{f.hint}</p>}
              {err && <p id={`${id}-err`} className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
          );
        })}
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : submitLabel}
        </button>
        {cancelHref && <Link href={cancelHref} className="btn btn-secondary">Cancelar</Link>}
      </div>
    </form>
  );
}
