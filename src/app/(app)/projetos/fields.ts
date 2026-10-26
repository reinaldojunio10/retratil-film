import type { Field, Option } from "@/components/form";
import { PROJECT_STATUS, options } from "@/lib/labels";

export const projectFields = (o: { clients: Option[]; users: Option[]; services: Option[] }): Field[] => [
  { name: "title", label: "Título", required: true },
  { name: "client_id", label: "Cliente", type: "select", options: o.clients },
  { name: "service_id", label: "Serviço", type: "select", options: o.services },
  { name: "status", label: "Etapa", type: "select", options: options(PROJECT_STATUS), required: true },
  { name: "shoot_date", label: "Data da gravação", type: "datetime-local" },
  { name: "delivery_date", label: "Prazo de entrega", type: "date" },
  { name: "location", label: "Local" },
  { name: "budget", label: "Orçamento (R$)", type: "money", hint: "Valor contratado; custos são lançados como despesas no Financeiro." },
  { name: "manager_id", label: "Responsável", type: "select", options: o.users },
  { name: "notes", label: "Observações", type: "textarea" },
];
