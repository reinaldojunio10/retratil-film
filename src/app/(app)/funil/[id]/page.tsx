import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/form";
import { ButtonLink, Card, DemoTag, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, toLocalInput } from "@/lib/format";
import { DEAL_STAGES, PROPOSAL_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { updateDeal } from "../actions";
import { dealFields } from "../fields";
import { History } from "@/components/history";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ perder?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => {
    const deal = await db.one<R>("select d.*, c.name client_name from deals d join clients c on c.id = d.client_id where d.id = $1", [id]);
    if (!deal) return null;
    return {
      user, deal,
      o: { clients: await lookups.clients(db), users: await lookups.users(db), services: await lookups.services(db) },
      proposals: await db.many<R>("select id, code, status, total from proposals where deal_id = $1 order by created_at desc", [id]),
    };
  }, "funil");
  if (!data) notFound();
  const { deal: d, user } = data;
  return (
    <>
      <PageHeader title={d.title} description={`${d.client_name} · ${brl(d.value)}`} back={{ href: "/funil", label: "Funil" }}
        actions={<>
          <DemoTag show={d.is_demo} />
          <StatusBadge map={DEAL_STAGES} value={d.stage} />
          {can(user, "propostas", true) && <ButtonLink href={`/propostas/nova?cliente=${d.client_id}&oportunidade=${d.id}`}>Criar proposta</ButtonLink>}
        </>} />
      {sp.perder && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Selecione a etapa “Perdido”, informe o motivo e salve.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Dados da oportunidade" className="lg:col-span-2">
          {can(user, "funil", true) ? (
            <EntityForm action={updateDeal.bind(null, d.id)} fields={dealFields(data.o)} defaults={{ ...d, stage: sp.perder ? "perdido" : d.stage, next_contact_at: toLocalInput(d.next_contact_at) }} />
          ) : <p className="text-sm text-stone-500">Somente leitura.</p>}
        </Card>
        <div className="space-y-6">
          <Card title="Propostas vinculadas">
            {data.proposals.length ? data.proposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                <Link href={`/propostas/${p.id}`} className="link">{p.code}</Link>
                <span className="flex items-center gap-2"><StatusBadge map={PROPOSAL_STATUS} value={p.status} />{brl(p.total)}</span>
              </div>
            )) : <p className="text-sm text-stone-500">Nenhuma proposta.</p>}
          </Card>
          <Card title="Cliente"><Link className="link text-sm" href={`/clientes/${d.client_id}`}>{d.client_name}</Link></Card>
          <History table="deals" id={d.id} />
        </div>
      </div>
    </>
  );
}
