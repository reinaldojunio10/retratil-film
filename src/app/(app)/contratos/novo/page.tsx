import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createContract } from "../actions";

export default async function NewContract({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({
    templates: await db.many<{ value: string; label: string }>("select id::text value, name label from contract_templates where active order by name"),
    clients: await lookups.clients(db),
    projects: await lookups.projects(db),
    proposals: await db.many<{ value: string; label: string }>("select p.id::text value, p.code || ' — ' || c.name || ' — ' || p.title label from proposals p join clients c on c.id = p.client_id where p.status in ('aprovada','enviada') order by p.created_at desc limit 300"),
    proposal: sp.proposta ? await db.one<{ client_id: string; title: string; project_id: string | null }>("select client_id, title, project_id from proposals where id = $1", [sp.proposta]) : null,
  }), "contratos");
  return (
    <>
      <PageHeader title="Novo contrato" description="Os dados do cliente, da proposta e da produção são preenchidos automaticamente no modelo." back={{ href: "/contratos", label: "Contratos" }} />
      <Card>
        <EntityForm action={createContract} submitLabel="Gerar contrato" cancelHref="/contratos"
          defaults={{ template_id: o.templates[0]?.value, proposal_id: sp.proposta, client_id: o.proposal?.client_id, title: o.proposal ? `Contrato — ${o.proposal.title}` : "", project_id: o.proposal?.project_id }}
          fields={[
            { name: "title", label: "Título", required: true },
            { name: "template_id", label: "Modelo", type: "select", options: o.templates, required: true },
            { name: "client_id", label: "Cliente (contratante)", type: "select", options: o.clients, required: true, emptyLabel: "Selecione…" },
            { name: "proposal_id", label: "Proposta (serviços e valores)", type: "select", options: o.proposals },
            { name: "project_id", label: "Produção", type: "select", options: o.projects },
            { name: "value", label: "Valor total (vazio = total da proposta)", type: "money", placeholder: "" },
            { name: "start_date", label: "Início", type: "date" },
            { name: "end_date", label: "Término / entrega", type: "date" },
            { name: "location", label: "Local de execução" },
            { name: "payment_terms", label: "Condições de pagamento (vazio = da proposta)", type: "textarea", rows: 2 },
          ]} />
      </Card>
    </>
  );
}
