import Link from "next/link";
import { ButtonLink, DemoTag, Empty, Filters, PageHeader, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { CONTRACT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Contratos" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; code: string; title: string; status: string; value: number; created_at: Date; client_name: string; is_demo: boolean }>(
      `select k.id, k.code, k.title, k.status, k.value, k.created_at, k.is_demo, c.name client_name from contracts k join clients c on c.id = k.client_id
        where ($1 = '' or k.title ilike '%' || $1 || '%' or k.code ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%') and ($2 = '' or k.status = $2)
        order by k.created_at desc limit 300`, [q, sp.status ?? ""]),
  }), "contratos");
  const w = can(user, "contratos", true);
  return (
    <>
      <PageHeader title="Contratos" description="Gerados a partir de modelos editáveis. Assinatura digital não integrada."
        actions={<>{w && <ButtonLink variant="secondary" href="/contratos/modelos">Modelos</ButtonLink>}{w && <ButtonLink href="/contratos/novo">Novo contrato</ButtonLink>}</>} />
      <Filters>
        <input name="q" defaultValue={q} placeholder="Buscar" className="input sm:w-72" aria-label="Buscar" />
        <select name="status" defaultValue={sp.status ?? ""} className="input sm:w-52" aria-label="Situação">
          <option value="">Todas as situações</option>
          {Object.entries(CONTRACT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Filters>
      <Table head={["Código", "Título", "Cliente", "Valor", "Criado em", "Situação"]} empty={!rows.length && <Empty title="Nenhum contrato" />}>
        {rows.map((k) => (
          <tr key={k.id} className="hover:bg-soft/50">
            <td className="td whitespace-nowrap"><Link className="link" href={`/contratos/${k.id}`}>{k.code}</Link><DemoTag show={k.is_demo} /></td>
            <td className="td">{k.title}</td><td className="td">{k.client_name}</td>
            <td className="td whitespace-nowrap">{brl(k.value)}</td><td className="td">{fmtDate(k.created_at)}</td>
            <td className="td"><StatusBadge map={CONTRACT_STATUS} value={k.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
