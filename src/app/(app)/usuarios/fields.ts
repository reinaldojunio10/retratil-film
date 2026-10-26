import type { Field } from "@/components/form";
import { ROLES } from "@/lib/permissions";

export const userFields: Field[] = [
  { name: "name", label: "Nome", required: true },
  { name: "email", label: "E-mail (login)", type: "email", required: true },
  { name: "phone", label: "WhatsApp (lembretes de tarefas)", type: "tel" },
  { name: "role", label: "Perfil", type: "select", required: true, options: Object.entries(ROLES).map(([value, label]) => ({ value, label })) },
  { name: "active", label: "Ativo (pode acessar o sistema)", type: "checkbox" },
];
