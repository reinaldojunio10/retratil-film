import { z } from "zod";
import { TZ_OFFSET } from "./format";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "") || v === undefined || v === null;

export const req = (max = 200, label = "Campo") =>
  z.string({ error: `${label} é obrigatório` }).trim().min(1, `${label} é obrigatório`).max(max, `Máximo de ${max} caracteres`);
export const opt = (max = 2000) =>
  z.preprocess((v) => (empty(v) ? null : v), z.string().trim().max(max, `Máximo de ${max} caracteres`).nullable());
export const optEmail = z.preprocess((v) => (empty(v) ? null : v), z.email("E-mail inválido").max(160).nullable());
export const optPhone = z.preprocess(
  (v) => (empty(v) ? null : v),
  z.string().trim().regex(/^[\d\s()+-]{8,20}$/, "Telefone inválido").nullable(),
);
export const optUuid = z.preprocess((v) => (empty(v) ? null : v), z.uuid("Seleção inválida").nullable());
export const uuid = z.uuid("Seleção inválida");

/** Aceita "1.234,56", "1234,56" e "1234.56" */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (empty(v)) return null;
  let s = String(v).trim().replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
export const money = z.preprocess((v) => parseMoney(v) ?? 0, z.number({ error: "Valor inválido" }).min(0, "Valor não pode ser negativo").max(99_999_999.99));
export const positiveMoney = z.preprocess((v) => parseMoney(v), z.number({ error: "Informe um valor" }).gt(0, "Valor deve ser maior que zero").max(99_999_999.99));
export const optMoney = z.preprocess((v) => parseMoney(v), z.number({ error: "Valor inválido" }).min(0).max(99_999_999.99).nullable());
export const qty = z.preprocess((v) => parseMoney(v), z.number({ error: "Quantidade inválida" }).gt(0, "Quantidade deve ser maior que zero").max(100000));
export const intQty = z.coerce.number({ error: "Quantidade inválida" }).int("Use um número inteiro").min(0).max(100000);

export const optDate = z.preprocess((v) => (empty(v) ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable());
export const reqDate = z.string({ error: "Data é obrigatória" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Data é obrigatória");
/** datetime-local (horário de São Paulo) -> ISO com fuso */
const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida").transform((s) => `${s}:00${TZ_OFFSET}`);
export const optDateTime = z.preprocess((v) => (empty(v) ? null : v), dt.nullable());
export const reqDateTime = z.preprocess((v) => (empty(v) ? undefined : v), dt);
export const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const oneOf = <T extends string>(values: readonly [T, ...T[]] | Record<T, unknown>) =>
  z.enum((Array.isArray(values) ? values : Object.keys(values)) as [T, ...T[]], { error: "Opção inválida" });

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super("Verifique os campos destacados.");
  }
}

export function formToObject(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (typeof v === "string") o[k] = v;
  }
  return o;
}

export function parse<S extends z.ZodType>(schema: S, input: FormData | Record<string, unknown>): z.infer<S> {
  const r = schema.safeParse(input instanceof FormData ? formToObject(input) : input);
  if (r.success) return r.data;
  const fe: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = String(i.path[0] ?? "_");
    if (!fe[k]) fe[k] = i.message;
  }
  throw new ValidationError(fe);
}

// ---------------------------------------------------------------- schemas
import { CLIENT_SOURCES, EQUIPMENT_CATEGORIES, INTERACTION_KINDS, SERVICE_CATEGORIES, SERVICE_UNITS, TX_CATEGORIES } from "./labels";

export const clientSchema = z.object({
  name: req(160, "Nome"),
  company: opt(160),
  document: opt(30),
  email: optEmail,
  phone: optPhone,
  whatsapp: optPhone,
  address: opt(240),
  city: opt(100),
  state: opt(2),
  source: oneOf(CLIENT_SOURCES),
  owner_id: optUuid,
  notes: opt(4000),
});

export const interactionSchema = z.object({
  kind: oneOf(INTERACTION_KINDS),
  summary: req(4000, "Resumo"),
  happened_at: optDateTime,
});

export const DEAL_STAGE_KEYS = ["novo", "contato", "qualificacao", "negociacao", "orcamento", "fechado", "perdido"] as const;
export const dealSchema = z
  .object({
    client_id: uuid,
    title: req(160, "Título"),
    stage: z.enum(DEAL_STAGE_KEYS),
    value: money,
    service_id: optUuid,
    owner_id: optUuid,
    next_contact_at: optDateTime,
    expected_close: optDate,
    lost_reason: opt(500),
    notes: opt(4000),
  })
  .refine((d) => d.stage !== "perdido" || !!d.lost_reason, { path: ["lost_reason"], message: "Informe o motivo da perda" });

export const serviceSchema = z.object({
  name: req(120, "Nome"),
  description: opt(2000),
  category: oneOf(SERVICE_CATEGORIES),
  unit: oneOf(SERVICE_UNITS),
  base_price: money,
  active: bool,
});

export const PROPOSAL_STATUS_KEYS = ["rascunho", "enviada", "aprovada", "recusada", "expirada", "cancelada"] as const;
export const proposalSchema = z
  .object({
    client_id: uuid,
    deal_id: optUuid,
    project_id: optUuid,
    title: req(160, "Título"),
    discount_type: z.enum(["valor", "percentual"]),
    discount_value: money,
    payment_terms: opt(2000),
    valid_until: optDate,
    notes: opt(4000),
  })
  .refine((d) => d.discount_type !== "percentual" || d.discount_value <= 100, { path: ["discount_value"], message: "Percentual máximo é 100" });

export const proposalItemSchema = z.object({
  service_id: optUuid,
  description: opt(500),
  quantity: qty,
  unit_price: optMoney,
});

export const templateSchema = z.object({ name: req(120, "Nome"), body: req(50000, "Texto do modelo"), active: bool });

export const contractCreateSchema = z.object({
  template_id: uuid,
  client_id: uuid,
  proposal_id: optUuid,
  project_id: optUuid,
  title: req(160, "Título"),
  value: optMoney,
  start_date: optDate,
  end_date: optDate,
  payment_terms: opt(2000),
  location: opt(240),
});

export const PROJECT_STATUS_KEYS = ["planejamento", "pre_producao", "gravacao", "edicao", "revisao", "entregue", "cancelado"] as const;
export const projectSchema = z.object({
  title: req(160, "Título"),
  client_id: optUuid,
  service_id: optUuid,
  status: z.enum(PROJECT_STATUS_KEYS),
  location: opt(240),
  shoot_date: optDateTime,
  delivery_date: optDate,
  budget: money,
  manager_id: optUuid,
  notes: opt(4000),
});
export const memberSchema = z.object({ user_id: optUuid, name: opt(120), role: req(80, "Função") });
export const fileSchema = z.object({
  name: req(160, "Nome"),
  url: z.url({ protocol: /^https?$/, error: "Informe um link http(s) válido" }).max(2000),
  notes: opt(500),
});

export const taskSchema = z.object({
  title: req(200, "Título"),
  description: opt(4000),
  kind: z.enum(["tarefa", "compromisso"]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
  due_at: optDateTime,
  location: opt(240),
  assignee_id: optUuid,
  client_id: optUuid,
  project_id: optUuid,
});

export const transactionSchema = z
  .object({
    type: z.enum(["receita", "despesa"]),
    description: req(200, "Descrição"),
    category: oneOf(TX_CATEGORIES),
    amount: positiveMoney,
    due_date: reqDate,
    status: z.enum(["pendente", "pago", "cancelado"]),
    paid_at: optDate,
    payment_method: opt(60),
    client_id: optUuid,
    project_id: optUuid,
    notes: opt(2000),
  })
  .transform((d) => ({ ...d, paid_at: d.status === "pago" ? d.paid_at ?? d.due_date : null }));

export const equipmentSchema = z.object({
  name: req(160, "Nome"),
  category: oneOf(EQUIPMENT_CATEGORIES),
  brand: opt(80),
  model: opt(80),
  serial_number: opt(80),
  quantity: intQty,
  daily_rate: money,
  replacement_value: optMoney,
  status: z.enum(["ativo", "manutencao", "inativo"]),
  notes: opt(2000),
});

export const reservationSchema = z
  .object({
    equipment_id: uuid,
    quantity: z.coerce.number().int().min(1, "Mínimo 1"),
    client_id: optUuid,
    project_id: optUuid,
    start_at: reqDateTime,
    end_at: reqDateTime,
    daily_rate: optMoney,
    conditions: opt(2000),
    notes: opt(2000),
  })
  .refine((d) => new Date(d.end_at) > new Date(d.start_at), { path: ["end_at"], message: "A devolução deve ser após a retirada" });

export const userSchema = z.object({
  name: req(120, "Nome"),
  email: z.email("E-mail inválido").max(160),
  phone: optPhone,
  role: z.enum(["owner", "admin", "comercial", "producao", "financeiro"]),
  active: bool,
});
export const passwordSchema = z.string().min(8, "Mínimo de 8 caracteres").max(200);

export const companySchema = z.object({
  legal_name: req(160, "Razão social"),
  trade_name: req(160, "Nome fantasia"),
  document: opt(30),
  address: opt(240),
  city: opt(100),
  state: opt(2),
  email: optEmail,
  phone: optPhone,
  website: opt(200),
  instagram: opt(100),
  bank_info: opt(1000),
  proposal_footer: opt(2000),
});

export const waTemplateSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Use apenas letras minúsculas, números e _ (igual ao nome no WhatsApp Manager)"),
  language: req(10, "Idioma"),
  category: z.enum(["utility", "marketing", "authentication"]),
  purpose: z.enum(["geral", "followup", "proposta", "tarefa", "boas_vindas"]),
  body_preview: req(1024, "Texto"),
  variables: z.coerce.number().int().min(0).max(10),
  approved: bool,
  active: bool,
});
