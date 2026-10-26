import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl } from "@/lib/format";
import { SERVICE_CATEGORIES, SERVICE_UNITS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Serviços" };



export default async function ServicesPage() {
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; name: string; category: string; unit: string; base_price: number; active: boolean }>("select * from services order by active desc, name"),
  }), "servicos");
  return (
    <>
      <PageHeader title="Serviços" description="Catálogo de serviços e valores base usados nas propostas."
        actions={can(user, "servicos", true) && <ButtonLink href="/servicos/novo">Novo serviço</ButtonLink>} />
      <Table head={["Serviço", "Categoria", "Unidade", "Valor base", "Situação"]} empty={!rows.length && <Empty title="Nenhum serviço cadastrado" />}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td className="td"><Link className="link" href={`/servicos/${s.id}`}>{s.name}</Link></td>
            <td className="td">{SERVICE_CATEGORIES[s.category]}</td>
            <td className="td">{SERVICE_UNITS[s.unit]}</td>
            <td className="td">{s.base_price > 0 ? brl(s.base_price) : <span className="text-amber-700">A definir</span>}</td>
            <td className="td">{s.active ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
