import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { saveEquipment } from "../actions";
import { equipmentFields } from "../fields";

export default async function NewEquipment() {
  await requireUser("equipamentos", true);
  return (
    <>
      <PageHeader title="Novo equipamento" back={{ href: "/equipamentos", label: "Equipamentos" }} />
      <Card><EntityForm action={saveEquipment.bind(null, null)} fields={equipmentFields} defaults={{ category: "camera", quantity: 1, status: "ativo" }} cancelHref="/equipamentos" /></Card>
    </>
  );
}
