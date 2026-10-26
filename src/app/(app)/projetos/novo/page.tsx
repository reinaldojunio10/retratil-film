import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createProject } from "../actions";
import { projectFields } from "../fields";

export default async function NewProject({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ clients: await lookups.clients(db), users: await lookups.users(db), services: await lookups.services(db) }), "projetos");
  return (
    <>
      <PageHeader title="Nova produção" back={{ href: "/projetos", label: "Produções" }} />
      <Card><EntityForm action={createProject} fields={projectFields(o)} defaults={{ status: "planejamento", client_id: sp.cliente }} cancelHref="/projetos" /></Card>
    </>
  );
}
