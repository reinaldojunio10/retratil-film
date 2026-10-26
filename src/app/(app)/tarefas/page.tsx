import Link from "next/link";
import { ButtonLink, Card, DemoTag, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { toggleTask } from "./actions";

export const metadata = { title: "Tarefas e agenda" };

type T = { id: string; title: string; kind: string; priority: string; status: string; due_at: Date | null; location: string | null; assignee: string | null; assignee_id: string | null; client_name: string | null; project_title: string | null; is_demo: boolean };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filtro?: string; resp?: string }> }) {
  const sp = await searchParams;
  const filtro = sp.filtro ?? "abertas";
  const { rows, agenda, user, users } = await tx(async (db, user) => ({
    user,
    users: await db.many<{ id: string; name: string }>("select id, name from users where active order by name"),
    rows: await db.many<T>(
      `select t.*, u.name assignee, c.name client_name, p.title project_title from tasks t
         left join users u on u.id = t.assignee_id left join clients c on c.id = t.client_id left join projects p on p.id = t.project_id
        where (case $1 when 'abertas' then t.status in ('pendente','em_andamento')
                       when 'atrasadas' then t.status in ('pendente','em_andamento') and t.due_at < now()
                       when 'minhas' then t.status in ('pendente','em_andamento') and t.assignee_id = $3::uuid
                       when 'concluidas' then t.status = 'concluida' else true end)
          and ($2 = '' or t.assignee_id::text = $2)
        order by t.status in ('concluida','cancelada'), t.due_at nulls last, t.created_at desc limit 300`, [filtro, sp.resp ?? "", user.id]),
    agenda: await db.many<T>(
      `select t.id, t.title, t.kind, t.priority, t.status, t.due_at, t.location, u.name assignee, t.assignee_id, c.name client_name, p.title project_title, t.is_demo
         from tasks t left join users u on u.id = t.assignee_id left join clients c on c.id = t.client_id left join projects p on p.id = t.project_id
        where t.status in ('pendente','em_andamento') and t.due_at between now() - interval '2 hours' and now() + interval '14 days'
        union all
       select null, 'Gravação: ' || p.title, 'compromisso', 'alta', 'pendente', p.shoot_date, p.location, null, null, c.name, p.title, p.is_demo
         from projects p left join clients c on c.id = p.client_id
        where p.shoot_date between now() - interval '2 hours' and now() + interval '14 days' and p.status not in ('entregue','cancelado')
        order by due_at limit 30`),
  }), "tarefas");
  const now = new Date();
  const tabs = [["abertas", "Abertas"], ["minhas", "Minhas"], ["atrasadas", "Atrasadas"], ["concluidas", "Concluídas"], ["todas", "Todas"]];

  return (
    <>
      <PageHeader title="Tarefas e agenda" actions={can(user, "tarefas", true) && <ButtonLink href="/tarefas/nova">Nova tarefa</ButtonLink>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1" aria-label="Filtro">
              {tabs.map(([k, l]) => (
                <Link key={k} href={`/tarefas?filtro=${k}${sp.resp ? `&resp=${sp.resp}` : ""}`} className={`rounded-md px-3 py-1.5 text-sm ${filtro === k ? "bg-white font-medium shadow-xs" : "text-stone-600 hover:text-ink"}`}>{l}</Link>
              ))}
            </nav>
            <form method="get" className="flex gap-2">
              <input type="hidden" name="filtro" value={filtro} />
              <select name="resp" defaultValue={sp.resp ?? ""} className="input w-44" aria-label="Responsável">
                <option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="btn btn-secondary">Filtrar</button>
            </form>
          </div>
          <div className="card divide-y divide-line">
            {rows.map((t) => {
              const late = t.due_at && new Date(t.due_at) < now && ["pendente", "em_andamento"].includes(t.status);
              const done = t.status === "concluida";
              const mayToggle = can(user, "tarefas", true) || t.assignee_id === user.id;
              return (
                <div key={t.id} className="flex items-start gap-3 p-4">
                  {mayToggle ? (
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={done ? "0" : "1"} />
                      <button className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${done ? "border-ink bg-ink text-white" : "border-stone-300 hover:border-ink"}`} aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}>{done && "✓"}</button>
                    </form>
                  ) : <span className="mt-0.5 h-5 w-5 rounded border border-stone-200" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/tarefas/${t.id}`} className={`text-sm font-medium hover:underline ${done ? "text-stone-400 line-through" : ""}`}>{t.title}</Link><DemoTag show={t.is_demo} />
                    <p className="mt-0.5 text-xs text-stone-500">
                      {[t.kind === "compromisso" ? "Compromisso" : null, t.assignee, t.client_name, t.project_title].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-xs ${late ? "font-semibold text-red-700" : "text-stone-500"}`}>{late && "Atrasada · "}{fmtDateTime(t.due_at)}</span>
                    <span className="flex gap-1"><StatusBadge map={PRIORITY} value={t.priority} />{t.status !== "pendente" && <StatusBadge map={TASK_STATUS} value={t.status} />}</span>
                  </div>
                </div>
              );
            })}
            {!rows.length && <Empty title="Nenhuma tarefa aqui" />}
          </div>
        </div>
        <Card title="Agenda — próximos 14 dias">
          {agenda.length ? (
            <ol className="space-y-3">
              {agenda.map((a, i) => (
                <li key={a.id ?? `p${i}`} className="border-l-2 border-ink pl-3">
                  <p className="text-xs font-medium text-stone-500">{fmtDateTime(a.due_at)}</p>
                  {a.id ? <Link href={`/tarefas/${a.id}`} className="text-sm font-medium hover:underline">{a.title}</Link> : <p className="text-sm font-medium">{a.title}</p>}
                  <p className="text-xs text-stone-500">{[a.location, a.client_name].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-stone-500">Nada agendado.</p>}
        </Card>
      </div>
    </>
  );
}
