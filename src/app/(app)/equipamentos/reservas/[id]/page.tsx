import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { History } from "@/components/history";
import { Card, Detail, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDateTime, toLocalInput } from "@/lib/format";
import { RESERVATION_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { chargeReservation, saveReservation, setReservationStatus } from "../../actions";
import { reservationFields } from "../../fields";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => ({
    user,
    r: await db.one<R>("select r.*, e.name equipment, c.name client_name from reservations r join equipment e on e.id = r.equipment_id left join clients c on c.id = r.client_id where r.id = $1", [id]),
    o: { equipment: await lookups.equipment(db), clients: await lookups.clients(db), projects: await lookups.projects(db) },
  }), "equipamentos");
  const { r, user } = data;
  if (!r) notFound();
  const w = can(user, "equipamentos", true);
  const Btn = ({ status, label, confirm }: { status: string; label: string; confirm?: string }) => (
    <form action={setReservationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={status} />
      {confirm ? <ConfirmButton message={confirm} className="btn btn-secondary">{label}</ConfirmButton> : <button className="btn btn-primary">{label}</button>}</form>
  );
  return (
    <>
      <PageHeader title={`${r.quantity}× ${r.equipment}`} description={`${fmtDateTime(r.start_at)} → ${fmtDateTime(r.end_at)} · ${brl(r.total)}`} back={{ href: "/equipamentos/reservas", label: "Reservas" }}
        actions={<StatusBadge map={RESERVATION_STATUS} value={r.status} />} />
      {w && (
        <div className="mb-6 flex flex-wrap gap-2">
          {r.status === "reservado" && <Btn status="retirado" label="Registrar retirada" />}
          {r.status === "retirado" && <Btn status="devolvido" label="Registrar devolução" />}
          {r.status === "reservado" && <Btn status="cancelado" label="Cancelar reserva" confirm="Cancelar esta reserva?" />}
          {can(user, "financeiro", true) && r.client_id && r.total > 0 && r.status !== "cancelado" && (
            <form action={chargeReservation}><input type="hidden" name="id" value={r.id} /><button className="btn btn-secondary">Lançar cobrança no financeiro</button></form>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Reserva">
          {w && ["reservado", "retirado"].includes(r.status)
            ? <EntityForm action={saveReservation.bind(null, r.id)} fields={reservationFields(data.o)} defaults={{ ...r, start_at: toLocalInput(r.start_at), end_at: toLocalInput(r.end_at) }} />
            : <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Cliente">{r.client_id ? <Link className="link" href={`/clientes/${r.client_id}`}>{r.client_name}</Link> : null}</Detail>
                <Detail label="Condições">{r.conditions}</Detail>
              </dl>}
        </Card>
        <div className="space-y-6">
          <Card title="Movimentação">
            <dl className="space-y-3">
              <Detail label="Retirado em">{fmtDateTime(r.picked_up_at)}</Detail>
              <Detail label="Devolvido em">{fmtDateTime(r.returned_at)}</Detail>
              <Detail label="Diária">{brl(r.daily_rate)}</Detail>
            </dl>
          </Card>
          <History table="reservations" id={r.id} />
        </div>
      </div>
    </>
  );
}
