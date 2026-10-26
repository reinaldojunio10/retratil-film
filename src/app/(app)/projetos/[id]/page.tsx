import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { ButtonLink, Card, DemoTag, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate, fmtDateTime, toLocalInput } from "@/lib/format";
import { PRIORITY, PROJECT_STATUS, RESERVATION_STATUS, TASK_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { PROJECT_STATUS_KEYS } from "@/lib/validation";
import { addFile, addMember, removeChild, setProjectStatus, updateProject } from "../actions";
import { projectFields } from "../fields";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => {
    const p = await db.one<R>("select p.*, c.name client_name from projects p left join clients c on c.id = p.client_id where p.id = $1", [id]);
    if (!p) return null;
    return {
      user, p,
      o: { clients: await lookups.clients(db), users: await lookups.users(db), services: await lookups.services(db) },
      members: await db.many<R>("select * from project_members where project_id = $1 order by created_at", [id]),
      files: await db.many<R>("select * from project_files where project_id = $1 order by created_at desc", [id]),
      tasks: await db.many<R>("select t.*, u.name assignee from tasks t left join users u on u.id = t.assignee_id where project_id = $1 order by status = 'concluida', due_at nulls last", [id]),
      reservations: await db.many<R>("select r.*, e.name equipment from reservations r join equipment e on e.id = r.equipment_id where r.project_id = $1 order by start_at", [id]),
      // custos/receitas: só aparecem para quem tem acesso ao financeiro (RLS devolve vazio para os demais)
      money: await db.one<{ custos: number; receitas: number }>(
        "select coalesce(sum(amount) filter (where type = 'despesa'), 0) custos, coalesce(sum(amount) filter (where type = 'receita'), 0) receitas from transactions where project_id = $1 and status <> 'cancelado'", [id]),
    };
  }, "projetos");
  if (!data) notFound();
  const { p, user } = data;
  const w = can(user, "projetos", true);
  const idx = PROJECT_STATUS_KEYS.indexOf(p.status);
  const next = idx >= 0 && idx < 5 ? PROJECT_STATUS_KEYS[idx + 1] : null;
  const fin = can(user, "financeiro");

  return (
    <>
      <PageHeader title={p.title} description={[p.client_name, p.location].filter(Boolean).join(" · ") || undefined} back={{ href: "/projetos", label: "Produções" }}
        actions={<>
          <DemoTag show={p.is_demo} /><StatusBadge map={PROJECT_STATUS} value={p.status} />
          {w && next && (
            <form action={setProjectStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={next} />
              <button className="btn btn-primary">Avançar para {PROJECT_STATUS[next].label}</button></form>
          )}
        </>} />

      <ol className="mb-6 grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label="Etapas da produção">
        {PROJECT_STATUS_KEYS.slice(0, 6).map((s, i) => (
          <li key={s} className={`rounded-md px-2 py-1.5 text-center text-xs font-medium ${p.status === "cancelado" ? "bg-stone-100 text-stone-400" : i <= idx ? "bg-ink text-white" : "bg-stone-100 text-stone-500"}`}>{PROJECT_STATUS[s].label}</li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Dados da produção">
            {w ? <EntityForm action={updateProject.bind(null, p.id)} fields={projectFields(data.o)} defaults={{ ...p, shoot_date: toLocalInput(p.shoot_date) }} />
              : <p className="text-sm">Gravação: {fmtDateTime(p.shoot_date)} · Entrega: {fmtDate(p.delivery_date)}</p>}
          </Card>
          <Card title="Tarefas e prazos" actions={can(user, "tarefas", true) && <ButtonLink size="sm" variant="secondary" href={`/tarefas/nova?projeto=${p.id}&cliente=${p.client_id ?? ""}`}>Nova tarefa</ButtonLink>}>
            {data.tasks.length ? (
              <ul className="divide-y divide-line">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/tarefas/${t.id}`} className={`link ${t.status === "concluida" ? "text-stone-400 line-through" : ""}`}>{t.title}</Link>
                    <span className="flex items-center gap-2 text-xs text-stone-500">{t.assignee} {fmtDateTime(t.due_at)} <StatusBadge map={PRIORITY} value={t.priority} /> <StatusBadge map={TASK_STATUS} value={t.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-500">Nenhuma tarefa.</p>}
          </Card>
          <Card title="Equipamentos reservados" actions={can(user, "equipamentos", true) && <ButtonLink size="sm" variant="secondary" href={`/equipamentos/reservas/nova?projeto=${p.id}`}>Reservar</ButtonLink>}>
            {data.reservations.length ? (
              <ul className="divide-y divide-line">
                {data.reservations.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link className="link" href={`/equipamentos/reservas/${r.id}`}>{r.quantity}× {r.equipment}</Link>
                    <span className="flex items-center gap-2 text-xs text-stone-500">{fmtDateTime(r.start_at)} → {fmtDateTime(r.end_at)} <StatusBadge map={RESERVATION_STATUS} value={r.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-500">Nenhuma reserva.</p>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Orçamento e custos">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Orçamento</dt><dd className="font-medium">{brl(p.budget)}</dd></div>
              {fin ? <>
                <div className="flex justify-between"><dt className="text-stone-500">Custos lançados</dt><dd>{brl(data.money?.custos)}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Receitas lançadas</dt><dd>{brl(data.money?.receitas)}</dd></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Margem prevista</dt><dd>{brl(p.budget - (data.money?.custos ?? 0))}</dd></div>
                {can(user, "financeiro", true) && <Link href={`/financeiro/novo?projeto=${p.id}&tipo=despesa`} className="link text-xs">Lançar custo</Link>}
              </> : <p className="text-xs text-stone-500">Custos visíveis apenas para o financeiro.</p>}
            </dl>
          </Card>
          <Card title="Equipe">
            <ul className="mb-4 space-y-2">
              {data.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span><span className="font-medium">{m.name}</span> <span className="text-stone-500">· {m.role}</span></span>
                  {w && <form action={removeChild}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="table" value="members" /><ConfirmButton message="Remover da equipe?" className="btn btn-ghost btn-sm">×</ConfirmButton></form>}
                </li>
              ))}
              {!data.members.length && <li className="text-sm text-stone-500">Ninguém escalado.</li>}
            </ul>
            {w && <EntityForm action={addMember.bind(null, p.id)} compact resetOnSuccess submitLabel="Adicionar" fields={[
              { name: "user_id", label: "Usuário do sistema", type: "select", options: data.o.users },
              { name: "name", label: "Ou nome (freelancer)" },
              { name: "role", label: "Função", required: true, placeholder: "Ex.: Câmera 1, Editor, Drone" },
            ]} />}
          </Card>
          <Card title="Arquivos e links">
            <ul className="mb-4 space-y-2">
              {data.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="link truncate">{f.name}</a>
                  {w && <form action={removeChild}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="table" value="files" /><ConfirmButton message="Remover link?" className="btn btn-ghost btn-sm">×</ConfirmButton></form>}
                </li>
              ))}
              {!data.files.length && <li className="text-sm text-stone-500">Nenhum arquivo vinculado.</li>}
            </ul>
            {w && <EntityForm action={addFile.bind(null, p.id)} compact resetOnSuccess submitLabel="Vincular" fields={[
              { name: "name", label: "Nome", required: true, placeholder: "Ex.: Brutos — Drive" },
              { name: "url", label: "Link (Drive, Dropbox, Frame.io…)", type: "url", required: true },
            ]} />}
          </Card>
        </div>
      </div>
    </>
  );
}
