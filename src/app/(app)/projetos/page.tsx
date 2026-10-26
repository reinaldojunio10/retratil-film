import Link from "next/link";
import { ButtonLink, DemoTag, Empty, Filters, PageHeader, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate, fmtDateTime, todayISO } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Produções" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = sp.status ?? "ativos";
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; title: string; status: string; shoot_date: Date | null; delivery_date: string | null; budget: number; client_name: string | null; manager: string | null; open_tasks: number; is_demo: boolean }>(
      `select p.id, p.title, p.status, p.shoot_date, p.delivery_date, p.budget, p.is_demo, c.name client_name, u.name manager,
              (select count(*) from tasks t where t.project_id = p.id and t.status in ('pendente','em_andamento')) open_tasks
         from projects p left join clients c on c.id = p.client_id left join users u on u.id = p.manager_id
        where ($1 = '' or p.title ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%')
          and (case when $2 = 'ativos' then p.status not in ('entregue','cancelado') when $2 = '' then true else p.status = $2 end)
        order by coalesce(p.shoot_date, p.delivery_date::timestamptz, p.created_at) limit 300`, [q, status]),
  }), "projetos");
  const today = todayISO();
  return (
    <>
      <PageHeader title="Produções" description="Projetos audiovisuais: gravação, edição, revisão e entrega."
        actions={can(user, "projetos", true) && <ButtonLink href="/projetos/novo">Nova produção</ButtonLink>} />
      <Filters>
        <input name="q" defaultValue={q} placeholder="Buscar por título ou cliente" className="input sm:w-72" aria-label="Buscar" />
        <select name="status" defaultValue={status} className="input sm:w-44" aria-label="Etapa">
          <option value="ativos">Em andamento</option><option value="">Todas</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Filters>
      <Table head={["Produção", "Cliente", "Gravação", "Entrega", "Orçamento", "Tarefas", "Etapa"]} empty={!rows.length && <Empty title="Nenhuma produção encontrada" />}>
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-soft/50">
            <td className="td"><Link className="link" href={`/projetos/${p.id}`}>{p.title}</Link><DemoTag show={p.is_demo} />{p.manager && <p className="text-xs text-stone-500">{p.manager}</p>}</td>
            <td className="td">{p.client_name ?? "—"}</td>
            <td className="td whitespace-nowrap">{fmtDateTime(p.shoot_date)}</td>
            <td className={`td whitespace-nowrap ${p.delivery_date && p.delivery_date < today && !["entregue", "cancelado"].includes(p.status) ? "font-medium text-red-700" : ""}`}>{fmtDate(p.delivery_date)}</td>
            <td className="td whitespace-nowrap">{brl(p.budget)}</td>
            <td className="td">{p.open_tasks}</td>
            <td className="td"><StatusBadge map={PROJECT_STATUS} value={p.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
