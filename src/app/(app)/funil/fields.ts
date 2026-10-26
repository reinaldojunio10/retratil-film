import type { Field, Option } from "@/components/form";
import { DEAL_STAGES, options } from "@/lib/labels";

export const dealFields = (o: { clients: Option[]; users: Option[]; services: Option[] }): Field[] => [
  { name: "title", label: "Título da oportunidade", required: true, placeholder: "Ex.: Videoclipe — single novo" },
  { name: "client_id", label: "Cliente", type: "select", options: o.clients, required: true, emptyLabel: "Selecione…" },
  { name: "stage", label: "Etapa", type: "select", options: options(DEAL_STAGES), required: true },
  { name: "value", label: "Valor estimado (R$)", type: "money" },
  { name: "service_id", label: "Serviço principal", type: "select", options: o.services },
  { name: "owner_id", label: "Responsável", type: "select", options: o.users },
  { name: "next_contact_at", label: "Próximo contato", type: "datetime-local" },
  { name: "expected_close", label: "Previsão de fechamento", type: "date" },
  { name: "lost_reason", label: "Motivo da perda (se perdido)", full: true },
  { name: "notes", label: "Observações", type: "textarea" },
];
