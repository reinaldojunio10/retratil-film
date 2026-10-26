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

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-[11px] font-black tracking-tighter text-ink">RF</div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Retrátil Film</p>
          <p className="text-[11px] text-stone-400">Gestão audiovisual</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Menu principal">
        {nav.map((n) => {
          const Icon = icons[n.key] ?? LayoutDashboard;
          const on = active(n.href);
          return (
            <Link key={n.key} href={n.href} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${on ? "bg-white/10 font-medium text-white" : "text-stone-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-stone-400">{roleLabel}</p>
        </div>
        <div className="flex gap-1">
          <Link href="/conta" className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-400 hover:bg-white/5 hover:text-white">
            <KeyRound className="h-3.5 w-3.5" /> Minha conta
          </Link>
          <form action={logoutAction}>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-400 hover:bg-white/5 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink shadow-xl">
            <button className="absolute right-3 top-4 rounded-md p-1 text-stone-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <button className="rounded-md p-1.5 hover:bg-soft" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">Retrátil Film</span>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      {toast && (
        <div role="status" className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${toast.kind === "erro" ? "bg-red-700 text-white" : "bg-ink text-white"}`}>
          {toast.message}
          <button className="ml-3 text-white/70 hover:text-white" onClick={() => setToast(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}
    </div>
  );
}
