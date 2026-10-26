import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { saveReservation } from "../../actions";
import { reservationFields } from "../../fields";

export default async function NewReservation({ searchParams }: { searchParams: Promise<{ equipamento?: string; projeto?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ equipment: await lookups.equipment(db), clients: await lookups.clients(db), projects: await lookups.projects(db) }), "equipamentos");
  return (
    <>
      <PageHeader title="Nova reserva" description="O sistema bloqueia reservas que ultrapassem a quantidade disponível no período." back={{ href: "/equipamentos/reservas", label: "Reservas" }} />
      <Card><EntityForm action={saveReservation.bind(null, null)} fields={reservationFields(o)} cancelHref="/equipamentos/reservas"
        defaults={{ quantity: 1, equipment_id: sp.equipamento, project_id: sp.projeto }} /></Card>
    </>
  );
}
