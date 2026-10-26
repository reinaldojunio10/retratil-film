export const TZ = "America/Sao_Paulo";
export const TZ_OFFSET = "-03:00"; // Brasil sem horário de verão desde 2019

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number | null | undefined) => brlFmt.format(Number(v ?? 0));

/** 'YYYY-MM-DD' ou Date -> dd/mm/aaaa */
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short" }).format(new Date(v));
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

/** Date -> valor para <input type="datetime-local"> no fuso de São Paulo */
export function toLocalInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
  return parts.replace(" ", "T");
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo */
export function todayISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

export function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

/** Normaliza telefone para o formato E.164 sem "+", assumindo Brasil (55) para 10/11 dígitos */
export function normalizePhone(v: string | null | undefined): string | null {
  const d = onlyDigits(v);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export function fmtPhone(v: string | null | undefined): string {
  const d = onlyDigits(v);
  if (!d) return "—";
  const local = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return v ?? "—";
}
