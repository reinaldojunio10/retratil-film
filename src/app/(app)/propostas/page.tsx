import Link from "next/link";
import { ButtonLink, DemoTag, Empty, Filters, PageHeader, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { PROPOSAL_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Propostas" };

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; code: string; title: string; status: string; total: number; valid_until: string | null; client_name: string; created_at: Date; is_demo: boolean }>(
      `select p.id, p.code, p.title, p.status, p.total, p.valid_until, p.created_at, p.is_demo, c.name client_name
         from proposals p join clients c on c.id = p.client_id
        where ($1 = '' or p.title ilike '%' || $1 || '%' or p.code ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%')
          and ($2 = '' or p.status = $2)
        order by p.created_at desc limit 300`, [q, sp.status ?? ""]),
  }), "propostas");
  return (
    <>
      <PageHeader title="Propostas" description="Orçamentos com itens, descontos, validade e PDF."
        actions={can(user, "propostas", true) && <ButtonLink href="/propostas/nova">Nova proposta</ButtonLink>} />
      <Filters>
        <input name="q" defaultValue={q} placeholder="Buscar por código, título ou cliente" className="input sm:w-80" aria-label="Buscar" />
        <select name="status" defaultValue={sp.status ?? ""} className="input sm:w-44" aria-label="Situação">
          <option value="">Todas as situações</option>
          {Object.entries(PROPOSAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Filters>
      <Table head={["Código", "Título", "Cliente", "Validade", "Total", "Situação"]} empty={!rows.length && <Empty title="Nenhuma proposta" />}>
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-soft/50">
            <td className="td whitespace-nowrap"><Link className="link" href={`/propostas/${p.id}`}>{p.code}</Link><DemoTag show={p.is_demo} /></td>
            <td className="td">{p.title}</td>
            <td className="td">{p.client_name}</td>
            <td className="td whitespace-nowrap">{fmtDate(p.valid_until)}</td>
            <td className="td whitespace-nowrap font-medium">{brl(p.total)}</td>
            <td className="td"><StatusBadge map={PROPOSAL_STATUS} value={p.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
