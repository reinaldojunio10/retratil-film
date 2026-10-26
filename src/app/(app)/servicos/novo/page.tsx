import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { saveService } from "../actions";
import { serviceFields } from "../fields";

export default async function NewService() {
  await requireUser("servicos", true);
  return (
    <>
      <PageHeader title="Novo serviço" back={{ href: "/servicos", label: "Serviços" }} />
      <Card><EntityForm action={saveService.bind(null, null)} fields={serviceFields} defaults={{ category: "producao", unit: "projeto", active: true }} cancelHref="/servicos" /></Card>
    </>
  );
}
