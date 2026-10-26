import { timingSafeEqual } from "crypto";
import { withSession } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Automações agendadas (ex.: Vercel Cron). Exige Authorization: Bearer <CRON_SECRET>. Nunca envia mensagens. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await withSession(null, (db) => db.one<{ r: unknown }>("select app_run_automations() r"));
  return Response.json(r?.r ?? {});
}
export const GET = handle;
export const POST = handle;
