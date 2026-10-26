import { timingSafeEqual } from "crypto";
import { withSession } from "@/lib/db";
import { verifySignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Verificação do webhook pela Meta (hub.challenge). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const got = u.searchParams.get("hub.verify_token") ?? "";
  const ok = !!token && u.searchParams.get("hub.mode") === "subscribe" && got.length === token.length && timingSafeEqual(Buffer.from(got), Buffer.from(token));
  if (!ok) return new Response("Forbidden", { status: 403 });
  return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Eventos (mensagens recebidas e status de entrega). Assinatura X-Hub-Signature-256 obrigatória. */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 1_000_000) return new Response("Payload too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response("Payload too large", { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400 }); }
  const valid = verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET);
  try {
    await withSession(null, (db) => db.one("select app_whatsapp_ingest($1::jsonb, $2) r", [JSON.stringify(payload), valid]));
  } catch (e) {
    console.error("[whatsapp webhook]", (e as Error).message);
    return new Response("Error", { status: 500 });
  }
  return new Response(valid ? "OK" : "Invalid signature", { status: valid ? 200 : 401 });
}
