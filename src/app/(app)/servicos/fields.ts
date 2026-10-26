import type { Field } from "@/components/form";
import { SERVICE_CATEGORIES, SERVICE_UNITS, options } from "@/lib/labels";

export const serviceFields: Field[] = [
  { name: "name", label: "Nome do serviço", required: true },
  { name: "category", label: "Categoria", type: "select", options: options(SERVICE_CATEGORIES), required: true },
  { name: "unit", label: "Unidade de cobrança", type: "select", options: options(SERVICE_UNITS), required: true },
  { name: "base_price", label: "Valor base (R$)", type: "money", hint: "Usado como sugestão nas propostas; pode ser ajustado em cada uma." },
  { name: "description", label: "Descrição (aparece na proposta)", type: "textarea" },
  { name: "active", label: "Ativo (disponível para novas propostas)", type: "checkbox" },
];
