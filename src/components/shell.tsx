"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, KanbanSquare, Tags, FileText, FileSignature, Clapperboard, CheckSquare,
  Wallet, Camera, MessageCircle, BarChart3, ShieldCheck, Settings, Menu, X, LogOut, KeyRound,
} from "lucide-react";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, clientes: Users, funil: KanbanSquare, servicos: Tags, propostas: FileText,
  contratos: FileSignature, projetos: Clapperboard, tarefas: CheckSquare, financeiro: Wallet, equipamentos: Camera,
  whatsapp: MessageCircle, relatorios: BarChart3, usuarios: ShieldCheck, configuracoes: Settings,
};

type NavItem = { key: string; label: string; href: string };

const BOTTOM_PRIORITY = ["dashboard", "clientes", "funil", "tarefas", "projetos", "financeiro", "propostas", "equipamentos"];
const SHORT: Record<string, string> = { dashboard: "Início", funil: "Funil", tarefas: "Tarefas", projetos: "Produções", equipamentos: "Equip." };

export function Shell({ nav, user, roleLabel, logoutAction, flash, children }: {
  nav: NavItem[]; user: { name: string; email: string }; roleLabel: string; logoutAction: () => Promise<void>;
  flash: { message: string; kind: "ok" | "erro" } | null; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(flash);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!flash) return;
    setToast(flash);
    document.cookie = "rf_flash=; Max-Age=0; path=/";
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);
  // gaveta aberta: trava a rolagem do fundo e fecha com Esc
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const bottom = BOTTOM_PRIORITY.map((k) => nav.find((n) => n.key === k)).filter((n): n is NavItem => !!n).slice(0, 4);

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-[11px] font-black tracking-tighter text-ink">RF</div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Retrátil Film</p>
          <p className="text-[11px] text-stone-400">Gestão audiovisual</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-2" aria-label="Menu principal">
        {nav.map((n) => {
          const Icon = icons[n.key] ?? LayoutDashboard;
          const on = active(n.href);
          return (
            <Link key={n.key} href={n.href} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 text-sm transition ${mobile ? "min-h-11" : "py-2"} ${on ? "bg-white/10 font-medium text-white" : "text-stone-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 pb-safe">
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-stone-400">{roleLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Link href="/conta" className={`flex flex-1 items-center gap-2 rounded-lg px-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white ${mobile ? "min-h-11" : "py-1.5"}`}>
            <KeyRound className="h-3.5 w-3.5" /> Minha conta e app
          </Link>
          <form action={logoutAction}>
            <button className={`flex items-center gap-2 rounded-lg px-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white ${mobile ? "min-h-11" : "py-1.5"}`}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink lg:block">{sidebar(false)}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="pt-safe absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-ink shadow-xl">
            <button className="absolute right-2 top-[calc(env(safe-area-inset-top)+0.75rem)] grid h-11 w-11 place-items-center rounded-md text-stone-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar(true)}
          </aside>
        </div>
      )}
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-2 px-2">
          <button className="grid h-11 w-11 place-items-center rounded-md hover:bg-soft" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Retrátil Film</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      {/* Navegação inferior no celular/tablet */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden" aria-label="Atalhos">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {bottom.map((n) => {
            const Icon = icons[n.key] ?? LayoutDashboard;
            const on = active(n.href);
            return (
              <li key={n.key}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-semibold text-ink" : "text-stone-500"}`}>
                  <Icon className="h-5 w-5" />
                  {SHORT[n.key] ?? n.label}
                </Link>
              </li>
            );
          })}
          <li className="col-start-5">
            <button onClick={() => setOpen(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] text-stone-500" aria-label="Mais opções do menu">
              <Menu className="h-5 w-5" />
              Mais
            </button>
          </li>
        </ul>
      </nav>
      {toast && (
        <div role="status" className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 rounded-lg px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-4 sm:max-w-sm lg:bottom-4 ${toast.kind === "erro" ? "bg-red-700 text-white" : "bg-ink text-white"}`}>
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button className="-m-2 grid h-10 w-10 shrink-0 place-items-center text-white/70 hover:text-white" onClick={() => setToast(null)} aria-label="Fechar aviso">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
