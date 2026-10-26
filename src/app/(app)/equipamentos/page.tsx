import Link from "next/link";
import { ButtonLink, DemoTag, Empty, Filters, PageHeader, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl } from "@/lib/format";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Equipamentos" };

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; name: string; brand: string | null; model: string | null; category: string; quantity: number; daily_rate: number; status: string; in_use: number; next: Date | null; is_demo: boolean }>(
      `select e.*, coalesce((select sum(quantity) from reservations r where r.equipment_id = e.id and r.status in ('reservado','retirado') and now() between r.start_at and r.end_at), 0) in_use,
              (select min(start_at) from reservations r where r.equipment_id = e.id and r.status = 'reservado' and r.start_at > now()) next
         from equipment e
        where ($1 = '' or e.name ilike '%' || $1 || '%' or e.brand ilike '%' || $1 || '%' or e.model ilike '%' || $1 || '%' or e.serial_number ilike '%' || $1 || '%')
          and ($2 = '' or e.category = $2)
        order by e.status <> 'ativo', e.name`, [q, sp.categoria ?? ""]),
  }), "equipamentos");
  const w = can(user, "equipamentos", true);
  return (
    <>
      <PageHeader title="Equipamentos" description="Inventário, disponibilidade e locações."
        actions={<><ButtonLink variant="secondary" href="/equipamentos/reservas">Reservas e locações</ButtonLink>{w && <ButtonLink href="/equipamentos/novo">Novo equipamento</ButtonLink>}</>} />
      <Filters>
        <input name="q" defaultValue={q} placeholder="Buscar por nome, marca, modelo ou série" className="input sm:w-80" aria-label="Buscar" />
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="input sm:w-44" aria-label="Categoria">
          <option value="">Todas as categorias</option>{Object.entries(EQUIPMENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Filters>
      <Table head={["Equipamento", "Categoria", "Disponível agora", "Diária", "Próxima reserva", "Situação"]} empty={!rows.length && <Empty title="Nenhum equipamento cadastrado" />}>
        {rows.map((e) => (
          <tr key={e.id} className="hover:bg-soft/50">
            <td className="td"><Link className="link" href={`/equipamentos/${e.id}`}>{e.name}</Link><DemoTag show={e.is_demo} /><p className="text-xs text-stone-500">{[e.brand, e.model].filter(Boolean).join(" ")}</p></td>
            <td className="td">{EQUIPMENT_CATEGORIES[e.category]}</td>
            <td className={`td font-medium ${e.quantity - e.in_use <= 0 ? "text-red-700" : ""}`}>{e.status === "ativo" ? `${e.quantity - e.in_use} de ${e.quantity}` : "—"}</td>
            <td className="td whitespace-nowrap">{brl(e.daily_rate)}</td>
            <td className="td text-xs">{e.next ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(e.next) : "—"}</td>
            <td className="td"><StatusBadge map={EQUIPMENT_STATUS} value={e.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
