export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "clientes", label: "Clientes", href: "/clientes" },
  { key: "funil", label: "Funil comercial", href: "/funil" },
  { key: "servicos", label: "Serviços", href: "/servicos" },
  { key: "propostas", label: "Propostas", href: "/propostas" },
  { key: "contratos", label: "Contratos", href: "/contratos" },
  { key: "projetos", label: "Produções", href: "/projetos" },
  { key: "tarefas", label: "Tarefas e agenda", href: "/tarefas" },
  { key: "financeiro", label: "Financeiro", href: "/financeiro" },
  { key: "equipamentos", label: "Equipamentos", href: "/equipamentos" },
  { key: "whatsapp", label: "WhatsApp", href: "/whatsapp" },
  { key: "relatorios", label: "Relatórios", href: "/relatorios" },
  { key: "usuarios", label: "Usuários", href: "/usuarios" },
  { key: "configuracoes", label: "Configurações", href: "/configuracoes" },
] as const;

export type Module = (typeof MODULES)[number]["key"];

export const ROLES = {
  owner: "Proprietário",
  admin: "Administrador",
  comercial: "Comercial",
  producao: "Produção",
  financeiro: "Financeiro",
} as const;
export type Role = keyof typeof ROLES;

export type Perms = Partial<Record<Module, { r: boolean; w: boolean }>>;
export type SessionUser = { id: string; name: string; email: string; role: Role; perms: Perms; tokenHash: string };

export function can(user: Pick<SessionUser, "role" | "perms"> | null | undefined, module: Module, write = false): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  const p = user.perms[module];
  return !!p && (write ? p.w : p.r);
}
