// Regras de cálculo puras (espelham os triggers do banco, que são a fonte da verdade)

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Item = { quantity: number; unit_price: number };

export function proposalTotals(items: Item[], discountType: "valor" | "percentual", discountValue: number) {
  const subtotal = round2(items.reduce((s, i) => s + round2(i.quantity * i.unit_price), 0));
  const discount =
    discountType === "percentual"
      ? round2(subtotal * (Math.min(Math.max(discountValue, 0), 100) / 100))
      : Math.min(Math.max(discountValue, 0), subtotal);
  return { subtotal, discount, total: round2(subtotal - discount) };
}

export type Tx = { type: "receita" | "despesa"; amount: number; status: string; due_date: string; paid_at?: string | null };

export function txEffectiveStatus(t: Pick<Tx, "status" | "due_date">, today: string) {
  return t.status === "pendente" && t.due_date < today ? "vencido" : t.status;
}

export function financeSummary(rows: Tx[], today: string) {
  const s = { receitasPagas: 0, despesasPagas: 0, aReceber: 0, aPagar: 0, vencidoReceber: 0, vencidoPagar: 0, saldo: 0 };
  for (const t of rows) {
    if (t.status === "cancelado") continue;
    const rec = t.type === "receita";
    if (t.status === "pago") {
      if (rec) s.receitasPagas += t.amount;
      else s.despesasPagas += t.amount;
    } else {
      if (rec) s.aReceber += t.amount;
      else s.aPagar += t.amount;
      if (t.due_date < today) {
        if (rec) s.vencidoReceber += t.amount;
        else s.vencidoPagar += t.amount;
      }
    }
  }
  for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] = round2(s[k]);
  s.saldo = round2(s.receitasPagas - s.despesasPagas);
  return s;
}

export function rentalDays(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/** Substitui {{chave}} pelos valores; chaves sem valor viram "________" para preenchimento manual. */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? "________" : v;
  });
}
