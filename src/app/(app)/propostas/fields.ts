import type { Field, Option } from "@/components/form";

export const proposalFields = (o: { clients: Option[]; deals: Option[]; projects: Option[] }): Field[] => [
  { name: "title", label: "Título", required: true, placeholder: "Ex.: Gravação do DVD ao vivo" },
  { name: "client_id", label: "Cliente", type: "select", options: o.clients, required: true, emptyLabel: "Selecione…" },
  { name: "deal_id", label: "Oportunidade (funil)", type: "select", options: o.deals },
  { name: "project_id", label: "Produção vinculada", type: "select", options: o.projects },
  { name: "discount_type", label: "Tipo de desconto", type: "select", required: true, options: [{ value: "valor", label: "Valor (R$)" }, { value: "percentual", label: "Percentual (%)" }] },
  { name: "discount_value", label: "Desconto", type: "money" },
  { name: "valid_until", label: "Válida até", type: "date" },
  { name: "payment_terms", label: "Condições de pagamento", type: "textarea", rows: 2, placeholder: "Ex.: 50% na assinatura e 50% na entrega, via PIX." },
  { name: "notes", label: "Observações (aparecem no PDF)", type: "textarea", rows: 3 },
];
