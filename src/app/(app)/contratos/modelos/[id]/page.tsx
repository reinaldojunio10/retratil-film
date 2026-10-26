import { notFound } from "next/navigation";
import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { saveTemplate } from "../../actions";
import { PLACEHOLDERS } from "../placeholders";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await tx((db) => db.one<Record<string, unknown>>("select * from contract_templates where id = $1", [id]), "contratos");
  if (!t) notFound();
  return (
    <>
      <PageHeader title={String(t.name)} back={{ href: "/contratos/modelos", label: "Modelos" }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <EntityForm action={saveTemplate.bind(null, id)} compact defaults={t} fields={[
            { name: "name", label: "Nome", required: true },
            { name: "body", label: "Texto", type: "textarea", rows: 30, required: true },
            { name: "active", label: "Ativo", type: "checkbox" },
          ]} />
        </Card>
        <Card title="Campos automáticos">
          <ul className="space-y-1.5 text-xs">
            {PLACEHOLDERS.map(([k, d]) => <li key={k}><code className="rounded bg-soft px-1 py-0.5">{`{{${k}}}`}</code> <span className="text-stone-500">{d}</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
