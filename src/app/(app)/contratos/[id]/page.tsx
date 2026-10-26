import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { History } from "@/components/history";
import { Card, DemoTag, Detail, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { CONTRACT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { deleteContract, setContractStatus, updateContractBody } from "../actions";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => ({
    user,
    k: await db.one<R>("select k.*, c.name client_name, p.code proposal_code, j.title project_title from contracts k join clients c on c.id = k.client_id left join proposals p on p.id = k.proposal_id left join projects j on j.id = k.project_id where k.id = $1", [id]),
  }), "contratos");
  const { k, user } = data;
  if (!k) notFound();
  const w = can(user, "contratos", true);
  const Btn = ({ status, label, confirm, primary }: { status: string; label: string; confirm?: string; primary?: boolean }) => (
    <form action={setContractStatus}>
      <input type="hidden" name="id" value={k.id} /><input type="hidden" name="status" value={status} />
      {confirm ? <ConfirmButton message={confirm} className="btn btn-secondary">{label}</ConfirmButton> : <button className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}>{label}</button>}
    </form>
  );
  return (
    <>
      <PageHeader title={k.title} description={`${k.code} · ${k.client_name} · ${brl(k.value)}`} back={{ href: "/contratos", label: "Contratos" }}
        actions={<><DemoTag show={k.is_demo} /><StatusBadge map={CONTRACT_STATUS} value={k.status} />
          <a href={`/api/contratos/${k.id}/pdf`} target="_blank" className="btn btn-secondary">Gerar PDF</a></>} />
      {w && (
        <div className="mb-6 flex flex-wrap items-end gap-2">
          {k.status === "rascunho" && <Btn status="emitido" label="Emitir contrato" primary confirm="Emitir o contrato? O texto ficará bloqueado para edição." />}
          {k.status === "emitido" && (
            <form action={setContractStatus} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={k.id} /><input type="hidden" name="status" value="assinado_manual" />
              <input name="note" className="input w-64" placeholder="Ex.: assinado em papel em 10/11" aria-label="Observação da assinatura" />
              <button className="btn btn-primary">Registrar assinatura (manual)</button>
            </form>
          )}
          {k.status === "emitido" && <Btn status="rascunho" label="Voltar para rascunho" />}
          {["rascunho", "emitido", "assinado_manual"].includes(k.status) && <Btn status="cancelado" label="Cancelar" confirm="Cancelar este contrato?" />}
          {k.status === "rascunho" && (
            <form action={deleteContract}><input type="hidden" name="id" value={k.id} />
              <ConfirmButton message="Excluir este rascunho?" className="btn btn-danger">Excluir rascunho</ConfirmButton></form>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Documento" className="lg:col-span-2">
          {w && k.status === "rascunho" ? (
            <EntityForm action={updateContractBody.bind(null, k.id)} compact defaults={k} fields={[
              { name: "title", label: "Título", required: true },
              { name: "body", label: "Texto do contrato", type: "textarea", rows: 28, hint: "Revise os trechos “________” antes de emitir." },
            ]} />
          ) : <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{k.body}</pre>}
        </Card>
        <div className="space-y-6">
          <Card title="Vínculos">
            <dl className="space-y-3">
              <Detail label="Cliente"><Link className="link" href={`/clientes/${k.client_id}`}>{k.client_name}</Link></Detail>
              <Detail label="Proposta">{k.proposal_id ? <Link className="link" href={`/propostas/${k.proposal_id}`}>{k.proposal_code}</Link> : null}</Detail>
              <Detail label="Produção">{k.project_id ? <Link className="link" href={`/projetos/${k.project_id}`}>{k.project_title}</Link> : null}</Detail>
              <Detail label="Período">{k.start_date || k.end_date ? `${fmtDate(k.start_date)} a ${fmtDate(k.end_date)}` : null}</Detail>
              <Detail label="Registro de assinatura">{k.signed_note}</Detail>
            </dl>
            <p className="mt-4 text-xs text-stone-500">Assinatura digital não está integrada. Registre a assinatura manualmente após coletá-la.</p>
          </Card>
          <History table="contracts" id={k.id} />
        </div>
      </div>
    </>
  );
}
