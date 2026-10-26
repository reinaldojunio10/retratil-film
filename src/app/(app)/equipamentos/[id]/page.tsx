import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/form";
import { History } from "@/components/history";
import { ButtonLink, Card, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDateTime } from "@/lib/format";
import { EQUIPMENT_STATUS, RESERVATION_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { saveEquipment } from "../actions";
import { equipmentFields } from "../fields";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function EquipmentItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => ({
    user,
    e: await db.one<R>("select * from equipment where id = $1", [id]),
    res: await db.many<R>("select r.*, c.name client_name, p.title project_title from reservations r left join clients c on c.id = r.client_id left join projects p on p.id = r.project_id where equipment_id = $1 order by start_at desc limit 100", [id]),
  }), "equipamentos");
  const { e, user } = data;
  if (!e) notFound();
  const w = can(user, "equipamentos", true);
  return (
    <>
      <PageHeader title={e.name} description={[e.brand, e.model, e.serial_number].filter(Boolean).join(" · ") || undefined} back={{ href: "/equipamentos", label: "Equipamentos" }}
        actions={<><StatusBadge map={EQUIPMENT_STATUS} value={e.status} />{w && <ButtonLink href={`/equipamentos/reservas/nova?equipamento=${e.id}`}>Reservar</ButtonLink>}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {w && <Card title="Dados do equipamento"><EntityForm action={saveEquipment.bind(null, e.id)} fields={equipmentFields} defaults={e} /></Card>}
          <Card title="Histórico de reservas e locações">
            {data.res.length ? (
              <ul className="divide-y divide-line">
                {data.res.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link className="link" href={`/equipamentos/reservas/${r.id}`}>{fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)}</Link>
                    <span className="flex items-center gap-2 text-xs text-stone-500">{r.quantity} un. · {r.client_name ?? r.project_title ?? "—"} · {brl(r.total)} <StatusBadge map={RESERVATION_STATUS} value={r.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-500">Nenhuma reserva.</p>}
          </Card>
        </div>
        <History table="equipment" id={e.id} />
      </div>
    </>
  );
}
