import { Card } from "./ui";
import { tx } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

const FIELD_LABELS: Record<string, string> = {
  stage: "Etapa", status: "Situação", value: "Valor", total: "Total", subtotal: "Subtotal", title: "Título", discount_value: "Desconto",
  discount_type: "Tipo de desconto", valid_until: "Validade", payment_terms: "Condições", owner_id: "Responsável", next_contact_at: "Próximo contato",
  notes: "Observações", body: "Texto", project_id: "Produção vinculada", deal_id: "Oportunidade", client_id: "Cliente", amount: "Valor", due_date: "Vencimento", paid_at: "Pagamento", name: "Nome", lost_reason: "Motivo da perda",
};
const ACTIONS: Record<string, string> = { insert: "Criado", update: "Alterado", delete: "Excluído" };

/** Histórico de alterações vindo do audit_log (visível para quem tem acesso a Configurações). */
export async function History({ table, id, alsoTables = [] }: { table: string; id: string; alsoTables?: string[] }) {
  const rows = await tx(async (db, user) => {
    if (!can(user, "configuracoes")) return null;
    return db.many<{ id: number; action: string; changes: Record<string, { de: unknown; para: unknown }> | null; created_at: Date; user_name: string | null; table_name: string }>(
      `select a.id, a.action, a.changes, a.created_at, a.table_name, u.name user_name from audit_log a left join users u on u.id = a.user_id
        where (a.table_name = $1 and a.record_id = $2) or (a.table_name = any($3) and a.changes->>'proposal_id' = $2::text)
           or (a.table_name = any($3) and a.changes->'proposal_id'->>'para' = $2::text)
        order by a.created_at desc limit 30`,
      [table, id, alsoTables],
    );
  });
  if (!rows) return null;
  return (
    <Card title="Histórico de alterações">
      {rows.length ? (
        <ol className="space-y-3 text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <p className="text-xs text-stone-500">{fmtDateTime(r.created_at)} · {r.user_name ?? "Sistema"}</p>
              <p>
                {r.table_name !== table ? (r.action === "insert" ? "Item adicionado" : r.action === "delete" ? "Item removido" : "Item alterado") : ACTIONS[r.action]}
                {r.action === "update" && r.changes && (
                  <span className="text-stone-500">: {Object.keys(r.changes).filter((k) => FIELD_LABELS[k]).map((k) => FIELD_LABELS[k]).join(", ") || "detalhes"}</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-stone-500">Sem registros.</p>}
    </Card>
  );
}
