import Link from "next/link";
import { Children, cloneElement, isValidElement } from "react";
import type { Tone } from "@/lib/labels";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-xs font-medium text-stone-500 hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="break-words text-xl font-semibold tracking-tight sm:truncate sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  dark: "bg-ink text-white ring-ink",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}
export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Card({ title, actions, children, className = "", padded = true }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === "danger" ? "text-red-700" : tone === "success" ? "text-emerald-700" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 h-10 w-10 rounded-full border border-dashed border-stone-300" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tabela que vira lista de cartões no celular: cada célula recebe o rótulo da coluna (data-label). */
export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }) {
  const labels = head.map((h) => (typeof h === "string" ? h : ""));
  const rows = Children.map(children, (row) => {
    if (!isValidElement<{ children?: React.ReactNode }>(row)) return row;
    const cells = Children.toArray(row.props.children).map((td, i) =>
      isValidElement(td) ? cloneElement(td as React.ReactElement<Record<string, unknown>>, { "data-label": labels[i] ?? "" }) : td,
    );
    return cloneElement(row, {}, ...cells);
  });
  return (
    <div className="card rtable overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-line">
          <thead className="bg-soft/60">
            <tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">{rows}</tbody>
        </table>
      </div>
      {empty}
    </div>
  );
}

export function ButtonLink({ href, children, variant = "primary", size }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm" }) {
  return <Link href={href} className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""}`}>{children}</Link>;
}

export function DemoTag({ show }: { show?: boolean }) {
  return show ? <span className="ml-1.5 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Demo</span> : null;
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children || "—"}</dd>
    </div>
  );
}

/** Barra de filtros (GET) */
export function Filters({ children }: { children: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end" method="get">
      {children}
      <button className="btn btn-secondary">Filtrar</button>
    </form>
  );
}
