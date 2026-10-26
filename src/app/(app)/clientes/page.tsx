import Link from "next/link";
import { ButtonLink, DemoTag, Empty, Filters, PageHeader, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtPhone } from "@/lib/format";
import { CLIENT_SOURCES } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Clientes" };

type Sp = Promise<{ q?: string; origem?: string; arquivados?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { rows, user } = await tx(async (db, user) => ({
    user,
    rows: await db.many<{ id: string; name: string; company: string | null; whatsapp: string | null; email: string | null; city: string | null; source: string; is_demo: boolean; deals: number; archived_at: Date | null }>(
      `select c.id, c.name, c.company, c.whatsapp, c.email, c.city, c.source, c.is_demo, c.archived_at,
              (select count(*) from deals d where d.client_id = c.id and d.stage not in ('fechado','perdido')) as deals
         from clients c
        where ($1 = '' or c.name ilike '%' || $1 || '%' or c.company ilike '%' || $1 || '%' or c.email ilike '%' || $1 || '%'
               or regexp_replace(coalesce(c.whatsapp,'') || ' ' || coalesce(c.phone,''), '\\D', '', 'g') like '%' || nullif(regexp_replace($1, '\\D', '', 'g'), '') || '%')
          and ($2 = '' or c.source = $2)
          and (case when $3 = '1' then c.archived_at is not null else c.archived_at is null end)
        order by lower(c.name) limit 300`,
      [q, sp.origem ?? "", sp.arquivados ?? ""],
    ),
  }), "clientes");

  return (
    <>
      <PageHeader title="Clientes" description="Cadastro, histórico de contatos e relacionamento."
        actions={can(user, "clientes", true) && <ButtonLink href="/clientes/novo">Novo cliente</ButtonLink>} />
      <Filters>
        <input name="q" defaultValue={q} placeholder="Buscar por nome, empresa, e-mail ou telefone" className="input sm:w-80" aria-label="Buscar" />
        <select name="origem" defaultValue={sp.origem ?? ""} className="input sm:w-44" aria-label="Origem">
          <option value="">Todas as origens</option>
          {Object.entries(CLIENT_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="arquivados" defaultValue={sp.arquivados ?? ""} className="input sm:w-36" aria-label="Situação">
          <option value="">Ativos</option>
          <option value="1">Arquivados</option>
        </select>
      </Filters>
      <Table head={["Nome", "WhatsApp", "E-mail", "Cidade", "Origem", "Negociações"]}
        empty={!rows.length && <Empty title="Nenhum cliente encontrado" description={q ? "Tente outra busca." : "Cadastre o primeiro cliente para começar."} />}>
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-soft/50">
            <td className="td">
              <Link href={`/clientes/${c.id}`} className="link">{c.name}</Link><DemoTag show={c.is_demo} />
              {c.company && <p className="text-xs text-stone-500">{c.company}</p>}
            </td>
            <td className="td whitespace-nowrap">{fmtPhone(c.whatsapp)}</td>
            <td className="td [overflow-wrap:anywhere]">{c.email ?? "—"}</td>
            <td className="td">{c.city ?? "—"}</td>
            <td className="td">{CLIENT_SOURCES[c.source]}</td>
            <td className="td">{c.deals}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
