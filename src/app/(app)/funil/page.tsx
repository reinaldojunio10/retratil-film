import Link from "next/link";
import { ButtonLink, DemoTag, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { brl, fmtDateTime } from "@/lib/format";
import { DEAL_STAGES } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { DEAL_STAGE_KEYS } from "@/lib/validation";
import { moveDeal } from "./actions";

export const metadata = { title: "Funil comercial" };

type Deal = { id: string; title: string; stage: string; value: number; client_name: string; owner_name: string | null; next_contact_at: Date | null; is_demo: boolean };

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ resp?: string }> }) {
  const sp = await searchParams;
  const { deals, user, users } = await tx(async (db, user) => ({
    user,
    users: await db.many<{ id: string; name: string }>("select id, name from users where active order by name"),
    deals: await db.many<Deal>(
      `select d.id, d.title, d.stage, d.value, d.next_contact_at, d.is_demo, c.name client_name, u.name owner_name
         from deals d join clients c on c.id = d.client_id left join users u on u.id = d.owner_id
        where ($1 = '' or d.owner_id::text = $1)
          and (d.stage not in ('fechado','perdido') or d.closed_at > now() - interval '60 days')
        order by d.next_contact_at nulls last, d.created_at desc`,
      [sp.resp ?? ""],
    ),
  }), "funil");
  const w = can(user, "funil", true);
  const now = new Date();

  return (
    <>
      <PageHeader title="Funil comercial" description="Fechados e perdidos aparecem por 60 dias."
        actions={<>
          <form method="get" className="flex w-full gap-2 sm:w-auto">
            <select name="resp" defaultValue={sp.resp ?? ""} className="input flex-1 sm:w-44" aria-label="Responsável">
              <option value="">Todos os responsáveis</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn btn-secondary">Filtrar</button>
          </form>
          {w && <ButtonLink href="/funil/novo">Nova oportunidade</ButtonLink>}
        </>} />
      {/* Quadro kanban: rolagem horizontal intencional, com "encaixe" por coluna no celular */}
      <nav className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden" aria-label="Ir para etapa" data-scroll-ok="1">
        {DEAL_STAGE_KEYS.map((s) => (
          <a key={s} href={`#etapa-${s}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-white px-3 text-xs font-medium">
            {DEAL_STAGES[s].label} · {deals.filter((d) => d.stage === s).length}
          </a>
        ))}
      </nav>
      <div className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:px-6 md:snap-none lg:-mx-8 lg:px-8" data-scroll-ok="1">
        <div className="flex gap-3 md:gap-4">
          {DEAL_STAGE_KEYS.map((stage, idx) => {
            const items = deals.filter((d) => d.stage === stage);
            const total = items.reduce((s, d) => s + d.value, 0);
            return (
              <section key={stage} id={`etapa-${stage}`} className="flex w-[85vw] max-w-72 shrink-0 snap-start scroll-mt-20 flex-col rounded-xl bg-stone-100/70 p-2 md:w-64" aria-label={DEAL_STAGES[stage].label}>
                <header className="px-2 py-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{DEAL_STAGES[stage].label}</h2>
                    <span className="text-xs text-stone-500">{items.length}</span>
                  </div>
                  <p className="text-xs text-stone-500">{brl(total)}</p>
                </header>
                <div className="space-y-2">
                  {items.map((d) => {
                    const late = d.next_contact_at && new Date(d.next_contact_at) < now && !["fechado", "perdido"].includes(d.stage);
                    return (
                      <article key={d.id} className="card p-3 shadow-xs">
                        <Link href={`/funil/${d.id}`} className="block text-sm font-medium hover:underline">{d.title}</Link>
                        <p className="mt-0.5 text-xs text-stone-500">{d.client_name}<DemoTag show={d.is_demo} /></p>
                        <p className="mt-2 text-sm font-semibold">{brl(d.value)}</p>
                        {d.next_contact_at && (
                          <p className={`mt-1 text-xs ${late ? "font-medium text-red-700" : "text-stone-500"}`}>
                            {late ? "Contato atrasado: " : "Próx. contato: "}{fmtDateTime(d.next_contact_at)}
                          </p>
                        )}
                        {d.owner_name && <p className="mt-1 text-xs text-stone-400">{d.owner_name}</p>}
                        {w && (
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
                            {idx > 0 && stage !== "perdido" && <MoveButton id={d.id} stage={DEAL_STAGE_KEYS[idx - 1]} label="←" title={`Mover para ${DEAL_STAGES[DEAL_STAGE_KEYS[idx - 1]].label}`} />}
                            {idx < 5 && <MoveButton id={d.id} stage={DEAL_STAGE_KEYS[idx + 1]} label="→" title={`Mover para ${DEAL_STAGES[DEAL_STAGE_KEYS[idx + 1]].label}`} />}
                            {idx < 5 && <MoveButton id={d.id} stage="fechado" label="Ganho" title="Marcar como fechado" />}
                            {idx < 5 && <MoveButton id={d.id} stage="perdido" label="Perdido" title="Marcar como perdido" />}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!items.length && <p className="px-2 py-6 text-center text-xs text-stone-400">Vazio</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MoveButton({ id, stage, label, title }: { id: string; stage: string; label: string; title: string }) {
  return (
    <form action={moveDeal}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stage" value={stage} />
      <button className="btn btn-ghost btn-sm px-2" title={title} aria-label={title}>{label}</button>
    </form>
  );
}
