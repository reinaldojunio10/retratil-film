import { createHmac, timingSafeEqual } from "crypto";

export type WaMode = "disabled" | "test" | "live";

export function waConfig() {
  const env = process.env;
  const requested = (["disabled", "test", "live"].includes(env.WHATSAPP_MODE ?? "") ? env.WHATSAPP_MODE : "disabled") as WaMode;
  const required = {
    WHATSAPP_ACCESS_TOKEN: !!env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: !!env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_VERIFY_TOKEN: !!env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: !!env.WHATSAPP_APP_SECRET,
  };
  const missing = Object.entries(required).filter(([, ok]) => !ok).map(([k]) => k);
  // "live" sem credenciais completas é rebaixado para "disabled": nunca simula sucesso de envio real
  const mode: WaMode = requested === "live" && missing.length ? "disabled" : requested;
  return { requested, mode, missing, apiVersion: env.WHATSAPP_API_VERSION || "v21.0" };
}

export function verifySignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

/** Mensagem livre só é permitida até 24h após a última mensagem recebida do contato (regra da Meta). */
export function insideServiceWindow(lastInbound: Date | null, now = new Date()) {
  return !!lastInbound && now.getTime() - new Date(lastInbound).getTime() < 24 * 3600 * 1000;
}

export type SendInput = { to: string; text?: string; template?: { name: string; language: string; params: string[] } };

export function buildPayload(i: SendInput) {
  if (i.template) {
    return {
      messaging_product: "whatsapp", to: i.to, type: "template",
      template: {
        name: i.template.name, language: { code: i.template.language },
        ...(i.template.params.length ? { components: [{ type: "body", parameters: i.template.params.map((text) => ({ type: "text", text })) }] } : {}),
      },
    };
  }
  return { messaging_product: "whatsapp", to: i.to, type: "text", text: { preview_url: false, body: i.text ?? "" } };
}

/** Envio real pela Cloud API. Só deve ser chamado em modo "live". */
export async function sendViaCloudApi(i: SendInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = waConfig();
  if (cfg.mode !== "live") return { ok: false, error: "Integração não está em modo de produção." };
  try {
    const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(i)),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok || !json.messages?.[0]?.id) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, id: json.messages[0].id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
