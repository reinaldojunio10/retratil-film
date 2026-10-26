import Link from "next/link";
import { EntityForm } from "@/components/form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { saveTemplate } from "../actions";
import { PLACEHOLDERS } from "./placeholders";

export default async function TemplatesPage() {
  const rows = await tx((db) => db.many<{ id: string; name: string; active: boolean }>("select id, name, active from contract_templates order by name"), "contratos");
  return (
    <>
      <PageHeader title="Modelos de contrato" back={{ href: "/contratos", label: "Contratos" }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Modelos">
            <ul className="divide-y divide-line">
              {rows.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <Link className="link" href={`/contratos/modelos/${t.id}`}>{t.name}</Link>{t.active ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Novo modelo">
            <EntityForm action={saveTemplate.bind(null, null)} compact defaults={{ active: true }} fields={[
              { name: "name", label: "Nome", required: true },
              { name: "body", label: "Texto", type: "textarea", rows: 14, required: true },
              { name: "active", label: "Ativo", type: "checkbox" },
            ]} />
          </Card>
        </div>
        <Card title="Campos automáticos">
          <ul className="space-y-1.5 text-xs">
            {PLACEHOLDERS.map(([k, d]) => <li key={k}><code className="rounded bg-soft px-1 py-0.5">{`{{${k}}}`}</code> <span className="text-stone-500">{d}</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
