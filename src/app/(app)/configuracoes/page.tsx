import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { saveCompany } from "./actions";

export const metadata = { title: "Configurações" };

const TABLES: Record<string, string> = {
  clients: "Cliente", deals: "Oportunidade", services: "Serviço", projects: "Produção", proposals: "Proposta", proposal_items: "Item de proposta",
  contracts: "Contrato", contract_templates: "Modelo de contrato", transactions: "Lançamento", equipment: "Equipamento", reservations: "Reserva", users: "Usuário",
};

export default async function SettingsPage() {
  const { company, logs, user } = await tx(async (db, user) => ({
    user,
    company: await db.one<Record<string, unknown>>("select * from company_settings where id = 1"),
    logs: await db.many<{ id: number; table_name: string; action: string; created_at: Date; user_name: string | null }>(
      "select a.id, a.table_name, a.action, a.created_at, u.name user_name from audit_log a left join users u on u.id = a.user_id order by a.id desc limit 40"),
  }), "configuracoes");
  return (
    <>
      <PageHeader title="Configurações" description="Dados da empresa usados em propostas, contratos e PDFs." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Dados da Retrátil Film" className="lg:col-span-2">
          {can(user, "configuracoes", true) ? (
            <EntityForm action={saveCompany} defaults={company ?? {}} fields={[
              { name: "trade_name", label: "Nome fantasia", required: true }, { name: "legal_name", label: "Razão social", required: true },
              { name: "document", label: "CNPJ / CPF" }, { name: "phone", label: "Telefone / WhatsApp", type: "tel" },
              { name: "email", label: "E-mail", type: "email" }, { name: "website", label: "Site" },
              { name: "instagram", label: "Instagram" }, { name: "address", label: "Endereço" },
              { name: "city", label: "Cidade" }, { name: "state", label: "UF" },
              { name: "bank_info", label: "Dados para pagamento (PIX, banco)", type: "textarea", rows: 2 },
              { name: "proposal_footer", label: "Texto de rodapé das propostas", type: "textarea", rows: 2 },
            ]} />
          ) : <p className="text-sm text-stone-500">Somente leitura.</p>}
        </Card>
        <Card title="Auditoria recente">
          <ol className="space-y-2 text-xs">
            {logs.map((l) => (
              <li key={l.id}><span className="text-stone-500">{fmtDateTime(l.created_at)}</span> · {l.user_name ?? "Sistema"} · {{ insert: "criou", update: "alterou", delete: "excluiu" }[l.action]} {TABLES[l.table_name] ?? l.table_name}</li>
            ))}
            {!logs.length && <li className="text-stone-500">Sem registros.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
