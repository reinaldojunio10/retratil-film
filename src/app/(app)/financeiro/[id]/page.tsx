import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { History } from "@/components/history";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { txEffectiveStatus } from "@/lib/calc";
import { brl, todayISO } from "@/lib/format";
import { TX_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { setTxStatus, updateTx } from "../actions";
import { txFields } from "../fields";

export default async function TxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => ({
    user,
    t: await db.one<Record<string, any>>("select * from transactions where id = $1", [id]), // eslint-disable-line @typescript-eslint/no-explicit-any
    o: { clients: await lookups.clients(db), projects: await lookups.projects(db) },
  }), "financeiro");
  const { t, user } = data;
  if (!t) notFound();
  const w = can(user, "financeiro", true);
  return (
    <>
      <PageHeader title={t.description} description={`${t.type === "receita" ? "Receita" : "Despesa"} · ${brl(t.amount)}`} back={{ href: "/financeiro", label: "Financeiro" }}
        actions={<><StatusBadge map={TX_STATUS} value={txEffectiveStatus(t as { status: string; due_date: string }, todayISO())} />
          {w && t.status !== "cancelado" && (
            <form action={setTxStatus}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="cancelado" />
              <ConfirmButton message="Cancelar este lançamento? Ele deixará de contar nos totais." className="btn btn-danger">Cancelar lançamento</ConfirmButton></form>
          )}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">{w ? <EntityForm action={updateTx.bind(null, t.id)} fields={txFields(data.o)} defaults={t} /> : <p>Somente leitura.</p>}</Card>
        <History table="transactions" id={t.id} />
      </div>
    </>
  );
}
