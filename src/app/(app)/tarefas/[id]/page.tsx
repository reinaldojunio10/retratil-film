import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtDateTime, toLocalInput } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { deleteTask, updateTask } from "../actions";
import { taskFields } from "../fields";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => ({
    user,
    t: await db.one<Record<string, any>>("select * from tasks where id = $1", [id]), // eslint-disable-line @typescript-eslint/no-explicit-any
    o: { users: await lookups.users(db), clients: await lookups.clients(db), projects: await lookups.projects(db) },
  }), "tarefas");
  const { t, user } = data;
  if (!t) notFound();
  const w = can(user, "tarefas", true);
  return (
    <>
      <PageHeader title={t.title} description={t.completed_at ? `Concluída em ${fmtDateTime(t.completed_at)}` : undefined} back={{ href: "/tarefas", label: "Tarefas" }}
        actions={<><StatusBadge map={TASK_STATUS} value={t.status} />
          {w && <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><ConfirmButton message="Excluir esta tarefa?" className="btn btn-danger">Excluir</ConfirmButton></form>}</>} />
      <Card>
        {w ? <EntityForm action={updateTask.bind(null, t.id)} fields={taskFields(data.o)} defaults={{ ...t, due_at: toLocalInput(t.due_at) }} />
          : <p className="whitespace-pre-wrap text-sm">{t.description ?? "Sem descrição."}</p>}
      </Card>
    </>
  );
}
