import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/pwa";

export const metadata: Metadata = {
  title: { default: "Retrátil Film", template: "%s · Retrátil Film" },
  description: "Sistema de Gestão Audiovisual da Retrátil Film",
  robots: { index: false, follow: false },
  applicationName: "Retrátil Film",
  appleWebApp: { capable: true, title: "Retrátil Film", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};
export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
