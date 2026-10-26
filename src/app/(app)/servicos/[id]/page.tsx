import { notFound } from "next/navigation";
import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { saveService } from "../actions";
import { serviceFields } from "../fields";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { s, user } = await tx(async (db, user) => ({ user, s: await db.one<Record<string, unknown>>("select * from services where id = $1", [id]) }), "servicos");
  if (!s) notFound();
  return (
    <>
      <PageHeader title={String(s.name)} back={{ href: "/servicos", label: "Serviços" }} />
      <Card>
        {can(user, "servicos", true)
          ? <EntityForm action={saveService.bind(null, id)} fields={serviceFields} defaults={s} />
          : <p className="text-sm text-stone-500">Somente leitura. {String(s.description ?? "")}</p>}
      </Card>
    </>
  );
}
