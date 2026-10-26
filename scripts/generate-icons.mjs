// Gera os ícones do PWA (public/icons) renderizando HTML no Chromium. Uso: node scripts/generate-icons.mjs
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = new URL("../public/icons/", import.meta.url).pathname;
const html = (size, scale) => `<html><body style="margin:0"><div style="width:${size}px;height:${size}px;background:#0a0a0a;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <div style="font-weight:900;font-size:${size * 0.36 * scale}px;letter-spacing:-${size * 0.02 * scale}px;line-height:1">RF</div>
  <div style="font-weight:700;font-size:${size * 0.075 * scale}px;letter-spacing:${size * 0.02 * scale}px;margin-top:${size * 0.03 * scale}px;color:#d6d3d1">FILM</div></div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, scale] of [["icon-192.png", 192, 1], ["icon-512.png", 512, 1], ["maskable-512.png", 512, 0.72], ["apple-touch-icon.png", 180, 0.9], ["favicon-32.png", 32, 1.15]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(html(size, scale));
  await p.screenshot({ path: out + name, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
console.log("ícones gerados em public/icons");
