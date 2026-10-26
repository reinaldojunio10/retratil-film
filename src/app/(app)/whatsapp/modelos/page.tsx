import { EntityForm, type Field } from "@/components/form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { saveWaTemplate } from "../actions";

const fields: Field[] = [
  { name: "name", label: "Nome (idêntico ao do WhatsApp Manager)", required: true },
  { name: "language", label: "Idioma", required: true },
  { name: "category", label: "Categoria", type: "select", required: true, options: [{ value: "utility", label: "Utilidade" }, { value: "marketing", label: "Marketing" }, { value: "authentication", label: "Autenticação" }] },
  { name: "purpose", label: "Uso no sistema", type: "select", required: true, options: [{ value: "geral", label: "Geral" }, { value: "followup", label: "Follow-up comercial" }, { value: "proposta", label: "Lembrete de proposta" }, { value: "tarefa", label: "Lembrete de tarefa" }, { value: "boas_vindas", label: "Boas-vindas" }] },
  { name: "variables", label: "Nº de variáveis ({{1}}, {{2}}…)", type: "number", required: true },
  { name: "body_preview", label: "Texto do modelo", type: "textarea", required: true, rows: 3 },
  { name: "approved", label: "Aprovado pela Meta", type: "checkbox" },
  { name: "active", label: "Ativo", type: "checkbox" },
];

export default async function WaTemplates() {
  const rows = await tx((db) => db.many<Record<string, any>>("select * from whatsapp_templates order by name"), "whatsapp"); // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <>
      <PageHeader title="Modelos de mensagem" description="Modelos precisam ser criados e aprovados no WhatsApp Manager; aqui você registra o nome e o texto para uso no sistema." back={{ href: "/whatsapp", label: "WhatsApp" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {rows.map((t) => (
            <Card key={t.id} title={t.name} actions={t.approved ? <Badge tone="success">Aprovado</Badge> : <Badge tone="warning">Não aprovado</Badge>}>
              <EntityForm action={saveWaTemplate.bind(null, t.id)} fields={fields} defaults={t} compact />
            </Card>
          ))}
        </div>
        <Card title="Novo modelo"><EntityForm action={saveWaTemplate.bind(null, null)} fields={fields} defaults={{ language: "pt_BR", category: "utility", purpose: "geral", variables: 0, approved: false, active: true }} compact /></Card>
      </div>
    </>
  );
}
