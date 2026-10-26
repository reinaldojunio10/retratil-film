export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "dark";
type Map = Record<string, { label: string; tone: Tone }>;

export const DEAL_STAGES: Map = {
  novo: { label: "Novo lead", tone: "info" },
  contato: { label: "Primeiro contato", tone: "neutral" },
  qualificacao: { label: "Qualificação", tone: "neutral" },
  negociacao: { label: "Negociação", tone: "warning" },
  orcamento: { label: "Orçamento enviado", tone: "warning" },
  fechado: { label: "Fechado", tone: "success" },
  perdido: { label: "Perdido", tone: "danger" },
};
export const PROPOSAL_STATUS: Map = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  enviada: { label: "Enviada", tone: "info" },
  aprovada: { label: "Aprovada", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
  expirada: { label: "Expirada", tone: "warning" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};
export const CONTRACT_STATUS: Map = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  emitido: { label: "Emitido", tone: "info" },
  assinado_manual: { label: "Assinado (registro manual)", tone: "success" },
  cancelado: { label: "Cancelado", tone: "danger" },
};
export const PROJECT_STATUS: Map = {
  planejamento: { label: "Planejamento", tone: "neutral" },
  pre_producao: { label: "Pré-produção", tone: "info" },
  gravacao: { label: "Gravação", tone: "warning" },
  edicao: { label: "Edição", tone: "warning" },
  revisao: { label: "Revisão", tone: "info" },
  entregue: { label: "Entregue", tone: "success" },
  cancelado: { label: "Cancelado", tone: "danger" },
};
export const TASK_STATUS: Map = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  concluida: { label: "Concluída", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};
export const PRIORITY: Map = {
  baixa: { label: "Baixa", tone: "neutral" },
  media: { label: "Média", tone: "info" },
  alta: { label: "Alta", tone: "warning" },
  urgente: { label: "Urgente", tone: "danger" },
};
export const TX_STATUS: Map = {
  pendente: { label: "Pendente", tone: "warning" },
  pago: { label: "Pago", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  vencido: { label: "Vencido", tone: "danger" },
};
export const RESERVATION_STATUS: Map = {
  reservado: { label: "Reservado", tone: "info" },
  retirado: { label: "Retirado", tone: "warning" },
  devolvido: { label: "Devolvido", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};
export const EQUIPMENT_STATUS: Map = {
  ativo: { label: "Ativo", tone: "success" },
  manutencao: { label: "Manutenção", tone: "warning" },
  inativo: { label: "Inativo", tone: "neutral" },
};
export const MESSAGE_STATUS: Map = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  simulado: { label: "Simulado (teste)", tone: "warning" },
  enviando: { label: "Enviando", tone: "info" },
  enviado: { label: "Enviado", tone: "info" },
  entregue: { label: "Entregue", tone: "success" },
  lido: { label: "Lido", tone: "success" },
  falhou: { label: "Falhou", tone: "danger" },
  recebido: { label: "Recebido", tone: "dark" },
};

export const CLIENT_SOURCES: Record<string, string> = {
  indicacao: "Indicação", instagram: "Instagram", whatsapp: "WhatsApp", site: "Site",
  google: "Google", evento: "Evento", cliente_antigo: "Cliente antigo", outro: "Outro",
};
export const INTERACTION_KINDS: Record<string, string> = {
  ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", reuniao: "Reunião", visita: "Visita", outro: "Outro",
};
export const SERVICE_CATEGORIES: Record<string, string> = {
  producao: "Produção", captacao: "Captação", edicao: "Edição", locacao: "Locação", outro: "Outro",
};
export const SERVICE_UNITS: Record<string, string> = {
  projeto: "Projeto", diaria: "Diária", hora: "Hora", unidade: "Unidade", minuto: "Minuto finalizado",
};
export const EQUIPMENT_CATEGORIES: Record<string, string> = {
  camera: "Câmera", lente: "Lente", audio: "Áudio", iluminacao: "Iluminação", suporte: "Suporte/tripé",
  drone: "Drone", acessorio: "Acessório", informatica: "Informática", outro: "Outro",
};
export const TX_CATEGORIES: Record<string, string> = {
  servicos: "Serviços prestados", locacao: "Locação de equipamentos", sinal: "Sinal/entrada",
  equipe: "Equipe/freelancers", equipamentos: "Compra/manutenção de equipamentos", transporte: "Transporte e viagens",
  alimentacao: "Alimentação", software: "Softwares e assinaturas", marketing: "Marketing", impostos: "Impostos e taxas",
  aluguel: "Aluguel e estrutura", outros: "Outros",
};

export const options = (m: Map | Record<string, string>) =>
  Object.entries(m).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));
