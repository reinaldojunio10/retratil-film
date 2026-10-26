import type { Field, Option } from "@/components/form";
import { CLIENT_SOURCES, options } from "@/lib/labels";

export const clientFields = (users: Option[]): Field[] => [
  { name: "name", label: "Nome", required: true },
  { name: "company", label: "Empresa / banda / artista" },
  { name: "whatsapp", label: "WhatsApp", type: "tel", placeholder: "(00) 00000-0000" },
  { name: "phone", label: "Telefone", type: "tel" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "document", label: "CPF / CNPJ" },
  { name: "address", label: "Endereço", full: true },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF", placeholder: "SP" },
  { name: "source", label: "Origem", type: "select", options: options(CLIENT_SOURCES), required: true },
  { name: "owner_id", label: "Responsável", type: "select", options: users },
  { name: "notes", label: "Observações", type: "textarea" },
];
