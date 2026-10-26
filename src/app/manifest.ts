import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Retrátil Film — Gestão Audiovisual",
    short_name: "Retrátil Film",
    description: "Sistema de Gestão Audiovisual da Retrátil Film",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Clientes", url: "/clientes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Funil comercial", url: "/funil", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tarefas", url: "/tarefas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
