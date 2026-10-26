import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, EntityForm } from "@/components/form";
import { Badge, ButtonLink, Card, DemoTag, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDate, fmtDateTime, fmtPhone, normalizePhone } from "@/lib/format";
import { DEAL_STAGES, INTERACTION_KINDS, MESSAGE_STATUS, PROJECT_STATUS, PROPOSAL_STATUS, options } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { addInteraction, deleteInteraction, setArchived, updateClient } from "../actions";
import { clientFields } from "../fields";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tx(async (db, user) => {
    const client = await db.one<R>("select * from clients where id = $1", [id]);
    if (!client) return null;
    return {
      user, client,
      users: await lookups.users(db),
      interactions: await db.many<R>("select i.*, u.name user_name from client_interactions i left join users u on u.id = i.user_id where client_id = $1 order by happened_at desc limit 100", [id]),
      deals: await db.many<R>("select id, title, stage, value from deals where client_id = $1 order by created_at desc", [id]),
      proposals: await db.many<R>("select id, code, title, status, total from proposals where client_id = $1 order by created_at desc", [id]),
      projects: await db.many<R>("select id, title, status, shoot_date from projects where client_id = $1 order by created_at desc", [id]),
      messages: await db.many<R>("select id, direction, body, status, created_at from whatsapp_messages where client_id = $1 order by created_at desc limit 10", [id]),
    };
  }, "clientes");
  if (!data) notFound();
  const { user, client: c } = data;
  const w = can(user, "clientes", true);
  const wa = normalizePhone(c.whatsapp);

  return (
    <>
      <PageHeader
        title={c.name}
        description={[c.company, c.city].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/clientes", label: "Clientes" }}
        actions={
          <>
            {c.archived_at && <Badge tone="warning">Arquivado</Badge>}
            <DemoTag show={c.is_demo} />
            {wa && <a className="btn btn-secondary" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
            {can(user, "funil", true) && <ButtonLink variant="secondary" href={`/funil/novo?cliente=${c.id}`}>Nova oportunidade</ButtonLink>}
            {can(user, "propostas", true) && <ButtonLink href={`/propostas/nova?cliente=${c.id}`}>Nova proposta</ButtonLink>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Dados do cliente">
            {w ? (
              <EntityForm action={updateClient.bind(null, c.id)} fields={clientFields(data.users)} defaults={{ ...c, whatsapp: c.whatsapp ? fmtPhone(c.whatsapp) : "" }} />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>WhatsApp: {fmtPhone(c.whatsapp)}</div><div>E-mail: {c.email ?? "—"}</div><div>Cidade: {c.city ?? "—"}</div>
              </dl>
            )}
          </Card>
          <Card title="Histórico de contatos">
            {w && (
              <div className="mb-6 rounded-lg bg-soft/60 p-4">
                <EntityForm action={addInteraction.bind(null, c.id)} resetOnSuccess submitLabel="Registrar contato"
                  fields={[
                    { name: "kind", label: "Tipo", type: "select", options: options(INTERACTION_KINDS), required: true },
                    { name: "happened_at", label: "Data/hora (vazio = agora)", type: "datetime-local" },
                    { name: "summary", label: "Resumo", type: "textarea", required: true, rows: 2 },
                  ]} defaults={{ kind: "whatsapp" }} />
              </div>
            )}
            {data.interactions.length ? (
              <ol className="space-y-4">
                {data.interactions.map((i) => (
                  <li key={i.id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-stone-500">{INTERACTION_KINDS[i.kind]} · {fmtDateTime(i.happened_at)} {i.user_name && `· ${i.user_name}`}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{i.summary}</p>
                    </div>
                    {w && (
                      <form action={deleteInteraction}>
                        <input type="hidden" name="id" value={i.id} />
                        <ConfirmButton message="Remover este registro de contato?" className="btn btn-ghost btn-sm">Remover</ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ol>
            ) : <Empty title="Nenhum contato registrado" />}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Oportunidades">
            <List items={data.deals} empty="Nenhuma oportunidade" render={(d) => (
              <><Link className="link" href={`/funil/${d.id}`}>{d.title}</Link><span className="flex items-center gap-2"><StatusBadge map={DEAL_STAGES} value={d.stage} /> {brl(d.value)}</span></>
            )} />
          </Card>
          <Card title="Propostas">
            <List items={data.proposals} empty="Nenhuma proposta" render={(p) => (
              <><Link className="link" href={`/propostas/${p.id}`}>{p.code}</Link><span className="flex items-center gap-2"><StatusBadge map={PROPOSAL_STATUS} value={p.status} /> {brl(p.total)}</span></>
            )} />
          </Card>
          <Card title="Produções">
            <List items={data.projects} empty="Nenhuma produção" render={(p) => (
              <><Link className="link" href={`/projetos/${p.id}`}>{p.title}</Link><span className="flex items-center gap-2 text-xs"><StatusBadge map={PROJECT_STATUS} value={p.status} /> {fmtDate(p.shoot_date)}</span></>
            )} />
          </Card>
          {can(user, "whatsapp") && (
            <Card title="WhatsApp" actions={<Link className="text-xs link" href={`/whatsapp?cliente=${c.id}`}>Ver conversa</Link>}>
              <List items={data.messages} empty="Nenhuma mensagem" render={(m) => (
                <><span className="line-clamp-2 text-xs">{m.direction === "in" ? "← " : "→ "}{m.body}</span><StatusBadge map={MESSAGE_STATUS} value={m.status} /></>
              )} />
            </Card>
          )}
          {w && (
            <form action={setArchived}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="archive" value={c.archived_at ? "0" : "1"} />
              <ConfirmButton message={c.archived_at ? "Reativar este cliente?" : "Arquivar este cliente? Ele deixará de aparecer nas listas, mas o histórico será mantido."} className="btn btn-secondary w-full">
                {c.archived_at ? "Reativar cliente" : "Arquivar cliente"}
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function List({ items, render, empty }: { items: R[]; render: (r: R) => React.ReactNode; empty: string }) {
  if (!items.length) return <p className="text-sm text-stone-500">{empty}</p>;
  return <ul className="divide-y divide-line">{items.map((r) => <li key={r.id} className="flex flex-col gap-1 py-2 text-sm first:pt-0 last:pb-0">{render(r)}</li>)}</ul>;
}
