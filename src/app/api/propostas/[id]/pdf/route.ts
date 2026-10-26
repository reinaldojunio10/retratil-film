import { tx } from "@/lib/auth";
import { proposalPdf, type Company, type ProposalPdf } from "@/lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Não encontrado", { status: 404 });
  const data = await tx(async (db) => {
    const p = await db.one<ProposalPdf & { client_id: string }>("select * from proposals where id = $1", [id]);
    if (!p) return null;
    return {
      company: (await db.one<Company>("select * from company_settings where id = 1"))!,
      p: {
        ...p,
        client: (await db.one<ProposalPdf["client"]>("select name, company, document, email, coalesce(whatsapp, phone) phone, city from clients where id = $1", [p.client_id]))!,
        items: await db.many<ProposalPdf["items"][number]>("select description, quantity, unit_price from proposal_items where proposal_id = $1 order by position, created_at", [id]),
      },
    };
  }, "propostas");
  if (!data) return new Response("Não encontrado", { status: 404 });
  const bytes = await proposalPdf(data.company, data.p);
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${data.p.code}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
