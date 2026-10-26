import { describe, expect, it } from "vitest";
import { normalizePhone, fmtPhone, fmtDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { clientSchema, dealSchema, parse, parseMoney, reservationSchema, transactionSchema, ValidationError } from "@/lib/validation";

describe("parseMoney", () => {
  it("aceita formatos brasileiros e internacionais", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("R$ 99,9")).toBe(99.9);
    expect(parseMoney("1234.5")).toBe(1234.5);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNaN();
  });
});

describe("schemas", () => {
  it("cliente exige nome e valida e-mail", () => {
    expect(() => parse(clientSchema, { name: "", source: "outro" })).toThrow(ValidationError);
    try { parse(clientSchema, { name: "Ana", email: "x@", source: "outro" }); } catch (e) { expect((e as ValidationError).fieldErrors.email).toBe("E-mail inválido"); }
    const ok = parse(clientSchema, { name: " Ana ", email: "", source: "instagram", whatsapp: "(11) 98888-7777" });
    expect(ok.name).toBe("Ana");
    expect(ok.email).toBeNull();
  });
  it("oportunidade perdida exige motivo", () => {
    const base = { client_id: "6b1f0a3e-4a5b-4c2d-9e8f-0a1b2c3d4e5f", title: "Teste", stage: "perdido", value: "100" };
    expect(() => parse(dealSchema, base)).toThrow(ValidationError);
    expect(parse(dealSchema, { ...base, lost_reason: "Preço" }).value).toBe(100);
  });
  it("lançamento: valor positivo e data de pagamento automática", () => {
    expect(() => parse(transactionSchema, { type: "receita", description: "X1", category: "servicos", amount: "0", due_date: "2026-10-01", status: "pendente" })).toThrow();
    const d = parse(transactionSchema, { type: "receita", description: "Show", category: "servicos", amount: "1.500,00", due_date: "2026-10-01", status: "pago" });
    expect(d.amount).toBe(1500);
    expect(d.paid_at).toBe("2026-10-01");
    expect(parse(transactionSchema, { type: "despesa", description: "Uber", category: "transporte", amount: "10", due_date: "2026-10-01", status: "pendente", paid_at: "2026-10-02" }).paid_at).toBeNull();
  });
  it("reserva: devolução após retirada, com fuso de São Paulo", () => {
    const base = { equipment_id: "6b1f0a3e-4a5b-4c2d-9e8f-0a1b2c3d4e5f", quantity: "1" };
    expect(() => parse(reservationSchema, { ...base, start_at: "2026-10-10T10:00", end_at: "2026-10-10T09:00" })).toThrow();
    expect(parse(reservationSchema, { ...base, start_at: "2026-10-10T10:00", end_at: "2026-10-11T10:00" }).start_at).toBe("2026-10-10T10:00:00-03:00");
  });
});

describe("formatação", () => {
  it("normaliza telefones brasileiros", () => {
    expect(normalizePhone("(11) 98888-7777")).toBe("5511988887777");
    expect(normalizePhone("+55 11 98888-7777")).toBe("5511988887777");
    expect(fmtPhone("5511988887777")).toBe("(11) 98888-7777");
    expect(fmtDate("2026-03-05")).toBe("05/03/2026");
  });
});

describe("permissões (interface)", () => {
  it("proprietário tem acesso total; demais seguem a matriz", () => {
    expect(can({ role: "owner", perms: {} }, "financeiro", true)).toBe(true);
    expect(can({ role: "comercial", perms: { financeiro: { r: false, w: false } } }, "financeiro")).toBe(false);
    expect(can({ role: "comercial", perms: { clientes: { r: true, w: false } } }, "clientes", true)).toBe(false);
    expect(can(null, "clientes")).toBe(false);
  });
});
