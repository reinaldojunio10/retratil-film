import Link from "next/link";
import { Card, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate, fmtDateTime, todayISO } from "@/lib/format";
import { PRIORITY, PROJECT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Dashboard" };

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function Dashboard() {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const d = await tx(async (db, user) => {
    const out: R = { user };
    if (can(user, "funil")) {
      out.sales = await db.one<R>(
        `select count(*) filter (where created_at >= $1::date) leads_mes,
                count(*) filter (where stage not in ('fechado','perdido')) em_andamento,
                coalesce(sum(value) filter (where stage not in ('fechado','perdido')), 0) valor_aberto,
                count(*) filter (where stage = 'fechado' and closed_at >= $1::date) fechadas_mes,
                coalesce(sum(value) filter (where stage = 'fechado' and closed_at >= $1::date), 0) valor_fechado_mes,
                count(*) filter (where stage not in ('fechado','perdido') and next_contact_at < now()) contatos_atrasados
           from deals`, [monthStart]);
    }
    if (can(user, "propostas")) {
      out.proposals = await db.one<R>(
        "select count(*) filter (where status = 'enviada') enviadas, coalesce(sum(total) filter (where status = 'enviada'), 0) valor_enviadas, count(*) filter (where status = 'aprovada' and decided_at >= $1::date) aprovadas_mes from proposals", [monthStart]);
    }
    if (can(user, "financeiro")) {
      out.fin = await db.one<R>(
        `select coalesce(sum(amount) filter (where type='receita' and status='pago' and paid_at >= $1::date), 0) receitas_mes,
                coalesce(sum(amount) filter (where type='despesa' and status='pago' and paid_at >= $1::date), 0) despesas_mes,
                coalesce(sum(amount) filter (where type='receita' and status='pendente' and due_date < $2::date), 0) receber_vencido,
                coalesce(sum(amount) filter (where type='despesa' and status='pendente' and due_date < $2::date), 0) pagar_vencido,
                coalesce(sum(amount) filter (where type='receita' and status='pendente' and due_date between $2::date and $2::date + 7), 0) receber_7d,
                coalesce(sum(amount) filter (where type='despesa' and status='pendente' and due_date between $2::date and $2::date + 7), 0) pagar_7d
           from transactions`, [monthStart, today]);
      out.bills = await db.many<R>("select id, type, description, amount, due_date from transactions where status = 'pendente' and due_date <= $1::date + 7 order by due_date limit 8", [today]);
    }
    if (can(user, "projetos")) {
      out.projects = await db.many<R>("select p.id, p.title, p.status, p.shoot_date, p.delivery_date, c.name client_name from projects p left join clients c on c.id = p.client_id where p.status not in ('entregue','cancelado') order by coalesce(p.shoot_date, p.delivery_date::timestamptz) nulls last limit 6");
      out.projectCount = (await db.one<{ n: number }>("select count(*) n from projects where status not in ('entregue','cancelado')"))!.n;
    }
    if (can(user, "tarefas")) {
      out.tasks = await db.many<R>(
        "select t.id, t.title, t.due_at, t.priority, t.kind, u.name assignee from tasks t left join users u on u.id = t.assignee_id where t.status in ('pendente','em_andamento') and (t.due_at is null or t.due_at < now() + interval '7 days') order by t.due_at nulls last limit 8");
      out.lateTasks = (await db.one<{ n: number }>("select count(*) n from tasks where status in ('pendente','em_andamento') and due_at < now()"))!.n;
    }
    if (can(user, "funil")) {
      out.followups = await db.many<R>("select d.id, d.title, d.next_contact_at, c.name client_name from deals d join clients c on c.id = d.client_id where d.stage not in ('fechado','perdido') and d.next_contact_at < now() + interval '3 days' order by d.next_contact_at limit 6");
    }
    out.demo = (await db.one<{ n: number }>("select (select count(*) from clients where is_demo) n"))?.n ?? 0;
    return out;
  });
  const now = new Date();

  return (
    <>
      <PageHeader title={`Olá, ${String(d.user.name).split(" ")[0]}`} description={`Visão geral de ${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(now)} — dados reais do banco.`} />
      {d.demo > 0 && <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">Existem registros de demonstração (marcados como DEMO) incluídos nos indicadores.</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.sales && <Stat label="Leads recebidos no mês" value={d.sales.leads_mes} hint={`${d.sales.contatos_atrasados} contato(s) atrasado(s)`} />}
        {d.sales && <Stat label="Negociações em andamento" value={d.sales.em_andamento} hint={brl(d.sales.valor_aberto)} />}
        {d.proposals && <Stat label="Orçamentos enviados (aguardando)" value={d.proposals.enviadas} hint={brl(d.proposals.valor_enviadas)} />}
        {d.sales && <Stat label="Vendas fechadas no mês" value={d.sales.fechadas_mes} hint={brl(d.sales.valor_fechado_mes)} tone="success" />}
        {d.fin && <Stat label="Faturamento recebido no mês" value={brl(d.fin.receitas_mes)} tone="success" />}
        {d.fin && <Stat label="Despesas pagas no mês" value={brl(d.fin.despesas_mes)} />}
        {d.fin && <Stat label="Vencidos (receber / pagar)" value={<span className="text-lg">{brl(d.fin.receber_vencido)} / {brl(d.fin.pagar_vencido)}</span>} tone={d.fin.receber_vencido + d.fin.pagar_vencido > 0 ? "danger" : undefined} />}
        {d.fin && <Stat label="A vencer em 7 dias (receber / pagar)" value={<span className="text-lg">{brl(d.fin.receber_7d)} / {brl(d.fin.pagar_7d)}</span>} />}
        {d.projects && <Stat label="Produções em andamento" value={d.projectCount} />}
        {d.tasks && <Stat label="Tarefas atrasadas" value={d.lateTasks} tone={d.lateTasks > 0 ? "danger" : undefined} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {d.tasks && (
          <Card title="Próximas tarefas e compromissos" actions={<Link href="/tarefas" className="text-xs link">Ver todas</Link>}>
            {d.tasks.length ? (
              <ul className="divide-y divide-line">
                {d.tasks.map((t: R) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/tarefas/${t.id}`} className="min-w-0 truncate hover:underline">{t.kind === "compromisso" && "📅 "}{t.title}</Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className={t.due_at && new Date(t.due_at) < now ? "font-semibold text-red-700" : "text-stone-500"}>{fmtDateTime(t.due_at)}</span>
                      <StatusBadge map={PRIORITY} value={t.priority} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhuma tarefa para os próximos dias" />}
          </Card>
        )}
        {d.followups && (
          <Card title="Follow-ups comerciais" actions={<Link href="/funil" className="text-xs link">Abrir funil</Link>}>
            {d.followups.length ? (
              <ul className="divide-y divide-line">
                {d.followups.map((f: R) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/funil/${f.id}`} className="min-w-0 truncate hover:underline">{f.title} <span className="text-stone-500">· {f.client_name}</span></Link>
                    <span className={`shrink-0 text-xs ${new Date(f.next_contact_at) < now ? "font-semibold text-red-700" : "text-stone-500"}`}>{fmtDateTime(f.next_contact_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhum follow-up pendente" />}
          </Card>
        )}
        {d.projects && (
          <Card title="Produções em andamento" actions={<Link href="/projetos" className="text-xs link">Ver todas</Link>}>
            {d.projects.length ? (
              <ul className="divide-y divide-line">
                {d.projects.map((p: R) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/projetos/${p.id}`} className="min-w-0 truncate hover:underline">{p.title} <span className="text-stone-500">· {p.client_name}</span></Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500">{p.shoot_date ? fmtDate(p.shoot_date) : fmtDate(p.delivery_date)} <StatusBadge map={PROJECT_STATUS} value={p.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhuma produção em andamento" />}
          </Card>
        )}
        {d.bills && (
          <Card title="Contas vencidas e a vencer (7 dias)" actions={<Link href="/financeiro" className="text-xs link">Financeiro</Link>}>
            {d.bills.length ? (
              <ul className="divide-y divide-line">
                {d.bills.map((b: R) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/financeiro/${b.id}`} className="min-w-0 truncate hover:underline">{b.description}</Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className={b.due_date < today ? "font-semibold text-red-700" : "text-stone-500"}>{fmtDate(b.due_date)}</span>
                      <span className={b.type === "receita" ? "text-emerald-700" : "text-red-700"}>{b.type === "receita" ? "+" : "−"}{brl(b.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhuma conta pendente nos próximos dias" />}
          </Card>
        )}
      </div>
    </>
  );
}
