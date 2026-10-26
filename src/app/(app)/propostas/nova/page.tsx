import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createProposal } from "../actions";
import { proposalFields } from "../fields";

export default async function NewProposal({ searchParams }: { searchParams: Promise<{ cliente?: string; oportunidade?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ clients: await lookups.clients(db), deals: await lookups.deals(db), projects: await lookups.projects(db) }), "propostas");
  const valid = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Nova proposta" back={{ href: "/propostas", label: "Propostas" }} />
      <Card>
        <EntityForm action={createProposal} fields={proposalFields(o)} submitLabel="Criar e adicionar itens" cancelHref="/propostas"
          defaults={{ client_id: sp.cliente, deal_id: sp.oportunidade, discount_type: "valor", valid_until: valid, payment_terms: "50% na assinatura do contrato e 50% na entrega." }} />
      </Card>
    </>
  );
}
