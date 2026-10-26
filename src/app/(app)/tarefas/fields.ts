import type { Field, Option } from "@/components/form";
import { PRIORITY, TASK_STATUS, options } from "@/lib/labels";

export const taskFields = (o: { users: Option[]; clients: Option[]; projects: Option[] }): Field[] => [
  { name: "title", label: "Título", required: true, full: true },
  { name: "kind", label: "Tipo", type: "select", required: true, options: [{ value: "tarefa", label: "Tarefa" }, { value: "compromisso", label: "Compromisso / reunião" }] },
  { name: "due_at", label: "Prazo / data e hora", type: "datetime-local" },
  { name: "priority", label: "Prioridade", type: "select", options: options(PRIORITY), required: true },
  { name: "status", label: "Situação", type: "select", options: options(TASK_STATUS), required: true },
  { name: "assignee_id", label: "Responsável", type: "select", options: o.users },
  { name: "location", label: "Local (compromissos)" },
  { name: "client_id", label: "Cliente", type: "select", options: o.clients },
  { name: "project_id", label: "Produção", type: "select", options: o.projects },
  { name: "description", label: "Descrição", type: "textarea" },
];
