import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildPayload, insideServiceWindow, verifySignature, waConfig } from "@/lib/whatsapp";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe("whatsapp", () => {
  it("valida assinatura HMAC do webhook", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "segredo").update(body).digest("hex");
    expect(verifySignature(body, sig, "segredo")).toBe(true);
    expect(verifySignature(body + " ", sig, "segredo")).toBe(false);
    expect(verifySignature(body, sig, undefined)).toBe(false);
    expect(verifySignature(body, null, "segredo")).toBe(false);
    expect(verifySignature(body, "sha256=zz", "segredo")).toBe(false);
  });
  it("janela de 24h", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    expect(insideServiceWindow(new Date("2026-10-26T00:00:00Z"), now)).toBe(true);
    expect(insideServiceWindow(new Date("2026-10-25T11:00:00Z"), now)).toBe(false);
    expect(insideServiceWindow(null, now)).toBe(false);
  });
  it("modo live sem credenciais é rebaixado para desativado", () => {
    process.env.WHATSAPP_MODE = "live";
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    expect(waConfig().mode).toBe("disabled");
    process.env.WHATSAPP_MODE = "test";
    expect(waConfig().mode).toBe("test");
    process.env.WHATSAPP_MODE = "qualquer";
    expect(waConfig().mode).toBe("disabled");
  });
  it("monta payload de modelo com variáveis", () => {
    expect(buildPayload({ to: "5511", template: { name: "t", language: "pt_BR", params: ["Ana"] } })).toMatchObject({
      type: "template", template: { name: "t", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }] }] },
    });
  });
});
