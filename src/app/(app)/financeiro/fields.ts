import type { Field, Option } from "@/components/form";
import { TX_CATEGORIES, options } from "@/lib/labels";

export const txFields = (o: { clients: Option[]; projects: Option[] }): Field[] => [
  { name: "type", label: "Tipo", type: "select", required: true, options: [{ value: "receita", label: "Receita (a receber)" }, { value: "despesa", label: "Despesa (a pagar)" }] },
  { name: "description", label: "Descrição", required: true },
  { name: "amount", label: "Valor (R$)", type: "money", required: true },
  { name: "category", label: "Categoria", type: "select", options: options(TX_CATEGORIES), required: true },
  { name: "due_date", label: "Vencimento", type: "date", required: true },
  { name: "status", label: "Situação", type: "select", required: true, options: [{ value: "pendente", label: "Pendente" }, { value: "pago", label: "Pago / recebido" }, { value: "cancelado", label: "Cancelado" }] },
  { name: "paid_at", label: "Data do pagamento (se pago)", type: "date" },
  { name: "payment_method", label: "Forma de pagamento", placeholder: "PIX, boleto, cartão…" },
  { name: "client_id", label: "Cliente", type: "select", options: o.clients },
  { name: "project_id", label: "Produção", type: "select", options: o.projects },
  { name: "notes", label: "Observações", type: "textarea", rows: 2 },
];
