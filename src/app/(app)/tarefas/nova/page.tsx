import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createTask } from "../actions";
import { taskFields } from "../fields";

export default async function NewTask({ searchParams }: { searchParams: Promise<{ projeto?: string; cliente?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ users: await lookups.users(db), clients: await lookups.clients(db), projects: await lookups.projects(db) }), "tarefas");
  return (
    <>
      <PageHeader title="Nova tarefa" back={{ href: "/tarefas", label: "Tarefas" }} />
      <Card><EntityForm action={createTask} fields={taskFields(o)} cancelHref="/tarefas"
        defaults={{ kind: "tarefa", priority: "media", status: "pendente", project_id: sp.projeto, client_id: sp.cliente }} /></Card>
    </>
  );
}
