import Link from "next/link";
import { ButtonLink, DemoTag, Empty, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { financeSummary, txEffectiveStatus, type Tx } from "@/lib/calc";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { TX_CATEGORIES, TX_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { setTxStatus } from "./actions";

export const metadata = { title: "Financeiro" };

type Row = Tx & { id: string; description: string; category: string; client_name: string | null; project_title: string | null; is_demo: boolean };

function monthRange() {
  const t = todayISO();
  const [y, m] = t.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { de: `${t.slice(0, 7)}-01`, ate: `${t.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; tipo?: string; situacao?: string; categoria?: string }> }) {
  const sp = await searchParams;
  const def = monthRange();
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const de = valid(sp.de) ?? def.de;
  const ate = valid(sp.ate) ?? def.ate;
  const today = todayISO();
  const { rows, user, overdue } = await tx(async (db, user) => ({
    user,
    rows: await db.many<Row>(
      `select t.id, t.type, t.description, t.category, t.amount, t.due_date, t.paid_at, t.status, t.is_demo, c.name client_name, p.title project_title
         from transactions t left join clients c on c.id = t.client_id left join projects p on p.id = t.project_id
        where t.due_date between $1 and $2 and ($3 = '' or t.type = $3) and ($4 = '' or t.category = $4)
          and (case $5 when '' then true when 'vencido' then t.status = 'pendente' and t.due_date < $6 else t.status = $5 end)
        order by t.due_date, t.created_at limit 1000`, [de, ate, sp.tipo ?? "", sp.categoria ?? "", sp.situacao ?? "", today]),
    overdue: await db.one<{ receber: number; pagar: number }>(
      "select coalesce(sum(amount) filter (where type='receita'),0) receber, coalesce(sum(amount) filter (where type='despesa'),0) pagar from transactions where status = 'pendente' and due_date < $1", [today]),
  }), "financeiro");
  const s = financeSummary(rows, today);
  const w = can(user, "financeiro", true);

  return (
    <>
      <PageHeader title="Financeiro" description="Receitas, despesas, contas a pagar e a receber."
        actions={w && <><ButtonLink variant="secondary" href="/financeiro/novo?tipo=despesa">Nova despesa</ButtonLink><ButtonLink href="/financeiro/novo?tipo=receita">Nova receita</ButtonLink></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido no período" value={brl(s.receitasPagas)} tone="success" />
        <Stat label="Pago no período" value={brl(s.despesasPagas)} />
        <Stat label="Resultado (realizado)" value={brl(s.saldo)} tone={s.saldo < 0 ? "danger" : "success"} />
        <Stat label="A receber / a pagar" value={<span className="text-lg">{brl(s.aReceber)} / {brl(s.aPagar)}</span>} hint="Pendentes no período" />
      </div>
      {(overdue!.receber > 0 || overdue!.pagar > 0) && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Vencidos (todas as datas): <strong>{brl(overdue!.receber)}</strong> a receber e <strong>{brl(overdue!.pagar)}</strong> a pagar.{" "}
          <Link className="underline" href={`/financeiro?de=2000-01-01&ate=${today}&situacao=vencido`}>Ver vencidos</Link>
        </div>
      )}
      <form method="get" className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label className="text-xs text-stone-500">De<input type="date" name="de" defaultValue={de} className="input mt-1" /></label>
        <label className="text-xs text-stone-500">Até<input type="date" name="ate" defaultValue={ate} className="input mt-1" /></label>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="input sm:w-36" aria-label="Tipo"><option value="">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>
        <select name="situacao" defaultValue={sp.situacao ?? ""} className="input sm:w-36" aria-label="Situação"><option value="">Todas</option>{Object.entries(TX_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="input sm:w-52" aria-label="Categoria"><option value="">Todas as categorias</option>{Object.entries(TX_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn btn-secondary col-span-2 sm:col-span-1">Filtrar</button>
      </form>
      <Table head={["Vencimento", "Descrição", "Categoria", "Valor", "Situação", ""]} empty={!rows.length && <Empty title="Nenhum lançamento no período" />}>
        {rows.map((t) => {
          const st = txEffectiveStatus(t, today);
          return (
            <tr key={t.id} className="hover:bg-soft/50">
              <td className="td whitespace-nowrap">{fmtDate(t.due_date)}</td>
              <td className="td">
                <Link className="link" href={`/financeiro/${t.id}`}>{t.description}</Link><DemoTag show={t.is_demo} />
                <p className="text-xs text-stone-500">{[t.client_name, t.project_title].filter(Boolean).join(" · ")}</p>
              </td>
              <td className="td text-xs">{TX_CATEGORIES[t.category] ?? t.category}</td>
              <td className={`td whitespace-nowrap font-medium ${t.type === "receita" ? "text-emerald-700" : "text-red-700"}`}>{t.type === "receita" ? "+" : "−"} {brl(t.amount)}</td>
              <td className="td"><StatusBadge map={TX_STATUS} value={st} />{t.paid_at && <p className="mt-1 text-xs text-stone-500">{fmtDate(t.paid_at)}</p>}</td>
              <td className="td text-right">
                {w && t.status === "pendente" && (
                  <form action={setTxStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="pago" />
                    <button className="btn btn-secondary btn-sm">{t.type === "receita" ? "Recebido" : "Pago"}</button></form>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
