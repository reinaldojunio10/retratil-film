import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, todayISO } from "@/lib/format";
import { CLIENT_SOURCES, DEAL_STAGES, TX_CATEGORIES } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Relatórios" };

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function Bars({ rows, value, label, format = (v: number) => String(v) }: { rows: R[]; value: (r: R) => number; label: (r: R) => string; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map(value));
  if (!rows.length) return <Empty title="Sem dados no período" />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-stone-600">{label(r)}</span>
          <span className="h-2 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-ink" style={{ width: `${(value(r) / max) * 100}%` }} /></span>
          <span className="text-right text-xs font-medium tabular-nums">{format(value(r))}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const ok = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const de = ok(sp.de) ?? `${Number(today.slice(0, 4))}-01-01`;
  const ate = ok(sp.ate) ?? today;
  const d = await tx(async (db, user) => {
    const o: R = { user };
    if (can(user, "funil")) {
      o.funnel = await db.many<R>("select stage, count(*) n, coalesce(sum(value),0) v from deals where created_at::date between $1 and $2 group by stage", [de, ate]);
      o.sources = await db.many<R>("select c.source, count(*) n from deals d join clients c on c.id = d.client_id where d.created_at::date between $1 and $2 group by c.source order by n desc", [de, ate]);
      o.lost = await db.many<R>("select coalesce(nullif(trim(lost_reason),''),'Não informado') reason, count(*) n from deals where stage = 'perdido' and closed_at::date between $1 and $2 group by 1 order by n desc limit 8", [de, ate]);
    }
    if (can(user, "propostas")) {
      o.prop = await db.one<R>("select count(*) filter (where status <> 'rascunho') enviadas, count(*) filter (where status = 'aprovada') aprovadas, coalesce(avg(total) filter (where status = 'aprovada'),0) ticket from proposals where created_at::date between $1 and $2", [de, ate]);
      o.services = await db.many<R>("select coalesce(s.name, 'Item avulso') name, sum(i.quantity * i.unit_price) v from proposal_items i join proposals p on p.id = i.proposal_id left join services s on s.id = i.service_id where p.status = 'aprovada' and p.decided_at::date between $1 and $2 group by 1 order by v desc limit 10", [de, ate]);
    }
    if (can(user, "financeiro")) {
      o.months = await db.many<R>(
        `select to_char(date_trunc('month', paid_at), 'MM/YYYY') m, date_trunc('month', paid_at) k,
                coalesce(sum(amount) filter (where type='receita'),0) rec, coalesce(sum(amount) filter (where type='despesa'),0) des
           from transactions where status = 'pago' and paid_at between $1 and $2 group by 1,2 order by k`, [de, ate]);
      o.cats = await db.many<R>("select category, sum(amount) v from transactions where type='despesa' and status='pago' and paid_at between $1 and $2 group by 1 order by v desc", [de, ate]);
    }
    return o;
  }, "relatorios");
  const totalRec = (d.months ?? []).reduce((s: number, m: R) => s + m.rec, 0);
  const totalDes = (d.months ?? []).reduce((s: number, m: R) => s + m.des, 0);
  const won = d.funnel?.find((f: R) => f.stage === "fechado")?.n ?? 0;
  const lost = d.funnel?.find((f: R) => f.stage === "perdido")?.n ?? 0;

  return (
    <>
      <PageHeader title="Relatórios" description="Indicadores calculados a partir dos registros do período." />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="text-xs text-stone-500">De<input type="date" name="de" defaultValue={de} className="input mt-1" /></label>
        <label className="text-xs text-stone-500">Até<input type="date" name="ate" defaultValue={ate} className="input mt-1" /></label>
        <button className="btn btn-secondary">Aplicar</button>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.funnel && <Stat label="Taxa de conversão (fechados / decididos)" value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"} hint={`${won} ganhos · ${lost} perdidos`} />}
        {d.prop && <Stat label="Propostas aprovadas / enviadas" value={`${d.prop.aprovadas} / ${d.prop.enviadas}`} hint={`Ticket médio ${brl(d.prop.ticket)}`} />}
        {d.months && <Stat label="Receitas recebidas" value={brl(totalRec)} tone="success" />}
        {d.months && <Stat label="Resultado (receitas − despesas)" value={brl(totalRec - totalDes)} tone={totalRec - totalDes < 0 ? "danger" : "success"} hint={`Despesas ${brl(totalDes)}`} />}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {d.months && (
          <Card title="Receitas × despesas por mês (realizado)">
            {d.months.length ? (
              <ul className="space-y-3">
                {d.months.map((m: R) => {
                  const max = Math.max(1, ...d.months.map((x: R) => Math.max(x.rec, x.des)));
                  return (
                    <li key={m.m} className="text-sm">
                      <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{m.m}</span><span className="text-stone-500">{brl(m.rec)} / {brl(m.des)}</span></div>
                      <div className="space-y-1">
                        <span className="block h-2 rounded-full bg-emerald-600" style={{ width: `${(m.rec / max) * 100}%` }} />
                        <span className="block h-2 rounded-full bg-red-400" style={{ width: `${(m.des / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
                <li className="flex gap-4 pt-1 text-xs text-stone-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />Receitas</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />Despesas</span></li>
              </ul>
            ) : <Empty title="Sem movimentações pagas no período" />}
          </Card>
        )}
        {d.funnel && <Card title="Oportunidades criadas por etapa atual"><Bars rows={Object.keys(DEAL_STAGES).map((s) => d.funnel.find((f: R) => f.stage === s) ?? { stage: s, n: 0 })} value={(r) => r.n} label={(r) => DEAL_STAGES[r.stage].label} /></Card>}
        {d.funnel && <Card title="Origem dos leads"><Bars rows={d.sources} value={(r) => r.n} label={(r) => CLIENT_SOURCES[r.source] ?? r.source} /></Card>}
        {d.services && <Card title="Serviços mais vendidos (propostas aprovadas)"><Bars rows={d.services} value={(r) => r.v} label={(r) => r.name} format={brl} /></Card>}
        {d.cats && <Card title="Despesas por categoria"><Bars rows={d.cats} value={(r) => r.v} label={(r) => TX_CATEGORIES[r.category] ?? r.category} format={brl} /></Card>}
        {d.lost && <Card title="Motivos de perda"><Bars rows={d.lost} value={(r) => r.n} label={(r) => r.reason} /></Card>}
      </div>
    </>
  );
}
