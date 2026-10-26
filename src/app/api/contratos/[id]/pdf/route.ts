import { tx } from "@/lib/auth";
import { contractPdf, type Company } from "@/lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Não encontrado", { status: 404 });
  const data = await tx(async (db) => ({
    company: (await db.one<Company>("select * from company_settings where id = 1"))!,
    k: await db.one<{ code: string; title: string; body: string; status: string }>("select code, title, body, status from contracts where id = $1", [id]),
  }), "contratos");
  if (!data.k) return new Response("Não encontrado", { status: 404 });
  const bytes = await contractPdf(data.company, data.k);
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${data.k.code}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
