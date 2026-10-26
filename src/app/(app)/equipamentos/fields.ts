import type { Field, Option } from "@/components/form";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUS, options } from "@/lib/labels";

export const equipmentFields: Field[] = [
  { name: "name", label: "Nome", required: true },
  { name: "category", label: "Categoria", type: "select", options: options(EQUIPMENT_CATEGORIES), required: true },
  { name: "brand", label: "Marca" },
  { name: "model", label: "Modelo" },
  { name: "serial_number", label: "Nº de série / patrimônio" },
  { name: "quantity", label: "Quantidade em estoque", type: "number", required: true },
  { name: "daily_rate", label: "Valor da diária de locação (R$)", type: "money" },
  { name: "replacement_value", label: "Valor de reposição (R$)", type: "money", placeholder: "" },
  { name: "status", label: "Situação", type: "select", options: options(EQUIPMENT_STATUS), required: true },
  { name: "notes", label: "Observações", type: "textarea" },
];

export const reservationFields = (o: { equipment: Option[]; clients: Option[]; projects: Option[] }): Field[] => [
  { name: "equipment_id", label: "Equipamento", type: "select", options: o.equipment, required: true, emptyLabel: "Selecione…" },
  { name: "quantity", label: "Quantidade", type: "number", required: true },
  { name: "start_at", label: "Retirada", type: "datetime-local", required: true },
  { name: "end_at", label: "Devolução", type: "datetime-local", required: true },
  { name: "client_id", label: "Cliente (locação externa)", type: "select", options: o.clients },
  { name: "project_id", label: "Produção (uso interno)", type: "select", options: o.projects },
  { name: "daily_rate", label: "Diária (R$) — vazio = valor do equipamento", type: "money", placeholder: "" },
  { name: "conditions", label: "Condições (caução, seguro, responsabilidade)", type: "textarea", rows: 2 },
  { name: "notes", label: "Observações", type: "textarea", rows: 2 },
];
