import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { History } from "@/components/history";
import { Card, DemoTag, Detail, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { PROPOSAL_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { addItem, createProjectFromProposal, createReceivable, deleteProposal, removeItem, setProposalStatus, updateProposal } from "../actions";
import { proposalFields } from "../fields";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const NEXT: Record<string, { status: string; label: string; primary?: boolean; confirm?: string }[]> = {
  rascunho: [{ status: "enviada", label: "Marcar como enviada", primary: true }, { status: "cancelada", label: "Cancelar", confirm: "Cancelar esta proposta?" }],
  enviada: [
    { status: "aprovada", label: "Aprovada pelo cliente", primary: true },
    { status: "recusada", label: "Recusada" }, { status: "expirada", label: "Expirada" },
    { status: "rascunho", label: "Voltar para rascunho" },
  ],
  aprovada: [{ status: "cancelada", label: "Cancelar", confirm: "Cancelar uma proposta aprovada?" }],
  recusada: [{ status: "rascunho", label: "Reabrir como rascunho" }],
  expirada: [{ status: "rascunho", label: "Reabrir como rascunho" }],
  cancelada: [{ status: "rascunho", label: "Reabrir como rascunho" }],
};

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => {
    const p = await db.one<R>("select p.*, c.name client_name from proposals p join clients c on c.id = p.client_id where p.id = $1", [id]);
    if (!p) return null;
    return {
      user, p,
      items: await db.many<R>("select * from proposal_items where proposal_id = $1 order by position, created_at", [id]),
      o: { clients: await lookups.clients(db), deals: await lookups.deals(db), projects: await lookups.projects(db) },
      services: await lookups.services(db),
      hasReceivable: !!(await db.one("select 1 from transactions where proposal_id = $1 and status <> 'cancelado'", [id])),
    };
  }, "propostas");
  if (!data) notFound();
  const { p, user, items } = data;
  const w = can(user, "propostas", true);
  const editable = w && p.status === "rascunho";
  const discount = p.subtotal - p.total;

  return (
    <>
      <PageHeader title={p.title} description={`${p.code} · ${p.client_name}`} back={{ href: "/propostas", label: "Propostas" }}
        actions={<>
          <DemoTag show={p.is_demo} />
          <StatusBadge map={PROPOSAL_STATUS} value={p.status} />
          <a href={`/api/propostas/${p.id}/pdf`} target="_blank" className="btn btn-secondary">Gerar PDF</a>
          {can(user, "contratos", true) && p.status === "aprovada" && <Link href={`/contratos/novo?proposta=${p.id}`} className="btn btn-secondary">Gerar contrato</Link>}
        </>} />

      {w && (
        <div className="mb-6 flex flex-wrap gap-2">
          {NEXT[p.status]?.map((n) => (
            <form key={n.status} action={setProposalStatus}>
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={n.status} />
              {n.confirm ? <ConfirmButton message={n.confirm} className="btn btn-secondary">{n.label}</ConfirmButton>
                : <button className={`btn ${n.primary ? "btn-primary" : "btn-secondary"}`}>{n.label}</button>}
            </form>
          ))}
          {p.status === "aprovada" && can(user, "projetos", true) && (
            <form action={createProjectFromProposal}><input type="hidden" name="id" value={p.id} />
              <button className="btn btn-secondary">{p.project_id ? "Abrir produção" : "Criar produção"}</button></form>
          )}
          {p.status === "aprovada" && can(user, "financeiro", true) && !data.hasReceivable && (
            <form action={createReceivable}><input type="hidden" name="id" value={p.id} />
              <button className="btn btn-secondary">Lançar conta a receber</button></form>
          )}
          {p.status === "rascunho" && (
            <form action={deleteProposal}><input type="hidden" name="id" value={p.id} />
              <ConfirmButton message="Excluir este rascunho definitivamente?" className="btn btn-danger">Excluir rascunho</ConfirmButton></form>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Itens" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] divide-y divide-line">
                <thead className="bg-soft/60"><tr><th className="th">Descrição</th><th className="th text-right">Qtd.</th><th className="th text-right">Unitário</th><th className="th text-right">Total</th>{editable && <th className="th" />}</tr></thead>
                <tbody className="divide-y divide-line">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="td whitespace-pre-wrap">{i.description}</td>
                      <td className="td text-right">{String(i.quantity).replace(".", ",")}</td>
                      <td className="td text-right whitespace-nowrap">{brl(i.unit_price)}</td>
                      <td className="td text-right whitespace-nowrap font-medium">{brl(i.quantity * i.unit_price)}</td>
                      {editable && (
                        <td className="td text-right">
                          <form action={removeItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="proposal_id" value={p.id} />
                            <ConfirmButton message="Remover este item?" className="btn btn-ghost btn-sm">Remover</ConfirmButton></form>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!items.length && <tr><td className="td text-center text-stone-500" colSpan={5}>Nenhum item adicionado.</td></tr>}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1 border-t border-line p-4 text-sm">
              <div className="flex justify-end gap-8"><dt className="text-stone-500">Subtotal</dt><dd className="w-32 text-right">{brl(p.subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-end gap-8"><dt className="text-stone-500">Desconto{p.discount_type === "percentual" ? ` (${p.discount_value}%)` : ""}</dt><dd className="w-32 text-right">- {brl(discount)}</dd></div>}
              <div className="flex justify-end gap-8 text-base font-semibold"><dt>Total</dt><dd className="w-32 text-right" data-testid="proposal-total">{brl(p.total)}</dd></div>
            </dl>
            {editable && (
              <div className="border-t border-line bg-soft/40 p-4">
                <p className="mb-3 text-sm font-medium">Adicionar item</p>
                <EntityForm action={addItem.bind(null, p.id)} resetOnSuccess submitLabel="Adicionar item" fields={[
                  { name: "service_id", label: "Serviço do catálogo", type: "select", options: data.services, hint: "Descrição e valor vazios usam os dados do serviço." },
                  { name: "description", label: "Descrição", placeholder: "Vazio = nome do serviço" },
                  { name: "quantity", label: "Quantidade", type: "money", required: true },
                  { name: "unit_price", label: "Valor unitário (R$)", type: "money", placeholder: "Vazio = valor base" },
                ]} defaults={{ quantity: 1 }} />
              </div>
            )}
          </Card>
          <Card title="Dados da proposta">
            {editable ? (
              <EntityForm action={updateProposal.bind(null, p.id)} fields={proposalFields(data.o)} defaults={p} />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Cliente"><Link className="link" href={`/clientes/${p.client_id}`}>{p.client_name}</Link></Detail>
                <Detail label="Validade">{fmtDate(p.valid_until)}</Detail>
                <Detail label="Condições de pagamento">{p.payment_terms}</Detail>
                <Detail label="Observações">{p.notes}</Detail>
                {p.deal_id && <Detail label="Oportunidade"><Link className="link" href={`/funil/${p.deal_id}`}>Abrir no funil</Link></Detail>}
                {p.project_id && <Detail label="Produção"><Link className="link" href={`/projetos/${p.project_id}`}>Abrir produção</Link></Detail>}
                {w && p.status !== "rascunho" && <p className="text-xs text-stone-500 sm:col-span-2">Para editar, volte a proposta para rascunho.</p>}
              </dl>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Resumo">
            <dl className="space-y-3">
              <Detail label="Enviada em">{fmtDate(p.sent_at)}</Detail>
              <Detail label="Decisão em">{fmtDate(p.decided_at)}</Detail>
              <Detail label="Criada em">{fmtDate(p.created_at)}</Detail>
            </dl>
          </Card>
          <History table="proposals" id={p.id} alsoTables={["proposal_items"]} />
        </div>
      </div>
    </>
  );
}
