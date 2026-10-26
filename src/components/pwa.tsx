"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Registra o service worker (apenas em produção; ele não guarda páginas nem dados privados). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** Botão/instruções para instalar o app na tela inicial (Android/Chrome: prompt nativo; iPhone: passo a passo). */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPlatform(ios ? "ios" : /android/i.test(ua) ? "android" : "desktop");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) return <p className="text-sm text-emerald-700">O app já está instalado neste aparelho.</p>;

  return (
    <div className="space-y-4 text-sm">
      {prompt && (
        <button className="btn btn-primary" onClick={async () => { await prompt.prompt(); const c = await prompt.userChoice; if (c.outcome === "accepted") setPrompt(null); }}>
          Instalar Retrátil Film
        </button>
      )}
      <div className={platform === "ios" ? "" : "opacity-80"}>
        <p className="font-medium">iPhone / iPad (Safari)</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-stone-600">
          <li>Abra o sistema no <strong>Safari</strong>.</li>
          <li>Toque em <strong>Compartilhar</strong> (quadrado com seta para cima).</li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.</li>
        </ol>
      </div>
      <div className={platform === "android" ? "" : "opacity-80"}>
        <p className="font-medium">Android (Chrome)</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-stone-600">
          <li>Toque em <strong>Instalar</strong> acima, se aparecer; ou</li>
          <li>abra o menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> / <strong>Adicionar à tela inicial</strong>.</li>
        </ol>
      </div>
      <div className={platform === "desktop" ? "" : "opacity-80"}>
        <p className="font-medium">Computador (Chrome ou Edge)</p>
        <p className="mt-1 text-stone-600">Clique no ícone de instalar na barra de endereço ou no menu → <strong>Instalar Retrátil Film</strong>.</p>
      </div>
      <p className="text-xs text-stone-500">O app usa os mesmos dados e permissões do site. Por segurança, nenhum dado fica salvo no aparelho para uso offline: é preciso estar conectado.</p>
    </div>
  );
}
