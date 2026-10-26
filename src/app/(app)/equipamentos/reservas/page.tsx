import Link from "next/link";
import { ButtonLink, DemoTag, Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDateTime } from "@/lib/format";
import { RESERVATION_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const sp = await searchParams;
  const st = sp.situacao ?? "ativas";
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
      `select r.*, e.name equipment, c.name client_name, p.title project_title from reservations r join equipment e on e.id = r.equipment_id
         left join clients c on c.id = r.client_id left join projects p on p.id = r.project_id
        where (case when $1 = 'ativas' then r.status in ('reservado','retirado') when $1 = '' then true else r.status = $1 end)
        order by r.start_at ${st === "ativas" ? "asc" : "desc"} limit 300`, [st]),
  }), "equipamentos");
  const now = new Date();
  return (
    <>
      <PageHeader title="Reservas e locações" back={{ href: "/equipamentos", label: "Equipamentos" }}
        actions={can(user, "equipamentos", true) && <ButtonLink href="/equipamentos/reservas/nova">Nova reserva</ButtonLink>} />
      <form method="get" className="mb-4 flex gap-2">
        <select name="situacao" defaultValue={st} className="input w-48" aria-label="Situação">
          <option value="ativas">Ativas</option><option value="">Todas</option>
          {Object.entries(RESERVATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn btn-secondary">Filtrar</button>
      </form>
      <Table head={["Equipamento", "Período", "Cliente / produção", "Total", "Situação"]} empty={!rows.length && <Empty title="Nenhuma reserva" />}>
        {rows.map((r) => {
          const late = r.status === "retirado" && new Date(r.end_at) < now;
          return (
            <tr key={r.id} className="hover:bg-soft/50">
              <td className="td"><Link className="link" href={`/equipamentos/reservas/${r.id}`}>{r.quantity}× {r.equipment}</Link><DemoTag show={r.is_demo} /></td>
              <td className={`td text-xs ${late ? "font-semibold text-red-700" : ""}`}>{fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}{late && " · devolução atrasada"}</td>
              <td className="td">{r.client_name ?? r.project_title ?? "—"}</td>
              <td className="td whitespace-nowrap">{brl(r.total)}</td>
              <td className="td"><StatusBadge map={RESERVATION_STATUS} value={r.status} /></td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
