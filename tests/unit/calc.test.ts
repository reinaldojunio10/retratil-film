import { describe, expect, it } from "vitest";
import { financeSummary, overlaps, proposalTotals, rentalDays, renderTemplate, txEffectiveStatus } from "@/lib/calc";

describe("proposalTotals", () => {
  it("soma itens e aplica desconto em valor", () => {
    expect(proposalTotals([{ quantity: 2, unit_price: 100 }, { quantity: 1, unit_price: 50.5 }], "valor", 50)).toEqual({ subtotal: 250.5, discount: 50, total: 200.5 });
  });
  it("aplica desconto percentual com arredondamento", () => {
    expect(proposalTotals([{ quantity: 3, unit_price: 33.33 }], "percentual", 10)).toEqual({ subtotal: 99.99, discount: 10, total: 89.99 });
  });
  it("nunca fica negativo", () => {
    expect(proposalTotals([{ quantity: 1, unit_price: 100 }], "valor", 500).total).toBe(0);
    expect(proposalTotals([{ quantity: 1, unit_price: 100 }], "percentual", 150).total).toBe(0);
  });
  it("evita erro de ponto flutuante", () => {
    expect(proposalTotals([{ quantity: 3, unit_price: 0.1 }], "valor", 0).subtotal).toBe(0.3);
  });
});

describe("financeiro", () => {
  const today = "2026-10-26";
  const rows = [
    { type: "receita" as const, amount: 1000, status: "pago", due_date: "2026-10-01" },
    { type: "receita" as const, amount: 500, status: "pendente", due_date: "2026-10-20" },
    { type: "receita" as const, amount: 300, status: "pendente", due_date: "2026-11-05" },
    { type: "despesa" as const, amount: 200.1, status: "pago", due_date: "2026-10-02" },
    { type: "despesa" as const, amount: 99.9, status: "pendente", due_date: "2026-10-25" },
    { type: "despesa" as const, amount: 1000, status: "cancelado", due_date: "2026-10-10" },
  ];
  it("calcula saldo realizado, pendências e vencidos ignorando cancelados", () => {
    expect(financeSummary(rows, today)).toEqual({
      receitasPagas: 1000, despesasPagas: 200.1, aReceber: 800, aPagar: 99.9, vencidoReceber: 500, vencidoPagar: 99.9, saldo: 799.9,
    });
  });
  it("marca pendente vencido", () => {
    expect(txEffectiveStatus({ status: "pendente", due_date: "2026-10-25" }, today)).toBe("vencido");
    expect(txEffectiveStatus({ status: "pendente", due_date: "2026-10-26" }, today)).toBe("pendente");
    expect(txEffectiveStatus({ status: "pago", due_date: "2026-01-01" }, today)).toBe("pago");
  });
});

describe("locação", () => {
  it("conta diárias com mínimo de 1", () => {
    expect(rentalDays(new Date("2026-01-01T10:00Z"), new Date("2026-01-01T12:00Z"))).toBe(1);
    expect(rentalDays(new Date("2026-01-01T10:00Z"), new Date("2026-01-03T10:00Z"))).toBe(2);
    expect(rentalDays(new Date("2026-01-01T10:00Z"), new Date("2026-01-03T11:00Z"))).toBe(3);
  });
  it("detecta sobreposição de períodos (limites encostados não conflitam)", () => {
    const d = (s: string) => new Date(s);
    expect(overlaps(d("2026-01-01"), d("2026-01-03"), d("2026-01-02"), d("2026-01-04"))).toBe(true);
    expect(overlaps(d("2026-01-01"), d("2026-01-03"), d("2026-01-03"), d("2026-01-04"))).toBe(false);
  });
});

describe("modelos de contrato", () => {
  it("substitui campos e marca ausentes para preenchimento", () => {
    expect(renderTemplate("A {{contratante_nome}} paga {{ valor_total }} em {{local}}", { contratante_nome: "Ana", valor_total: "R$ 10,00" })).toBe("A Ana paga R$ 10,00 em ________");
  });
});
