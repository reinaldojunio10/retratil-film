import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createDeal } from "../actions";
import { dealFields } from "../fields";

export default async function NewDeal({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ clients: await lookups.clients(db), users: await lookups.users(db), services: await lookups.services(db) }), "funil");
  return (
    <>
      <PageHeader title="Nova oportunidade" back={{ href: "/funil", label: "Funil" }} />
      <Card><EntityForm action={createDeal} fields={dealFields(o)} defaults={{ stage: "novo", client_id: sp.cliente }} cancelHref="/funil" /></Card>
    </>
  );
}
