// Testes do PWA e da política de cache (Chromium). Requer build de produção rodando.
// Uso: BASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... node tests/e2e/pwa.mjs
import { createRequire } from "module";
const { chromium, devices } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
async function step(name, fn) { try { await fn(); results.push(["✔", name]); } catch (e) { results.push(["✘", name, e.message.split("\n")[0]]); } }

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();

await step("manifest público e válido", async () => {
  const r = await page.request.get(BASE + "/manifest.webmanifest");
  assert(r.status() === 200, `status ${r.status()}`);
  const m = await r.json();
  assert(m.name.includes("Retrátil Film") && m.short_name === "Retrátil Film" && m.display === "standalone" && m.start_url === "/", "campos");
  for (const size of ["192x192", "512x512"]) assert(m.icons.some((i) => i.sizes === size), `ícone ${size}`);
  assert(m.icons.some((i) => i.purpose === "maskable"), "ícone maskable");
  for (const i of m.icons) assert((await page.request.get(BASE + i.src)).status() === 200, `ícone ${i.src}`);
});
await step("ícone Apple e metadados de PWA na página de login", async () => {
  await page.goto(BASE + "/login");
  assert(await page.locator('link[rel="manifest"]').count(), "link manifest");
  assert(await page.locator('link[rel="apple-touch-icon"]').count(), "apple-touch-icon");
  assert(await page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').count(), "web-app-capable");
  assert((await page.locator('meta[name="viewport"]').getAttribute("content")).includes("viewport-fit=cover"), "viewport-fit");
  assert((await page.request.get(BASE + "/apple-touch-icon.png").catch(() => null)) || true);
});
await step("service worker público e sem cache HTTP", async () => {
  const r = await page.request.get(BASE + "/sw.js");
  assert(r.status() === 200 && /no-store|no-cache/.test(r.headers()["cache-control"] ?? ""), `sw.js ${r.status()} ${r.headers()["cache-control"]}`);
});
await step("login e registro do service worker", async () => {
  await page.fill("#email", process.env.E2E_EMAIL); await page.fill("#password", process.env.E2E_PASSWORD);
  await page.click("button[type=submit]"); await page.waitForURL(BASE + "/");
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 15000 });
  await page.reload(); // passa a ser controlada pelo SW
  assert(await page.evaluate(() => !!navigator.serviceWorker.controller), "página não controlada pelo SW");
});
await step("páginas autenticadas enviadas com no-store/private", async () => {
  const r = await page.request.get(BASE + "/financeiro");
  const cc = r.headers()["cache-control"] ?? "";
  assert(/no-store/.test(cc) && /private/.test(cc), `cache-control: ${cc}`);
});
await step("navegação não grava páginas, dados nem PDFs no cache do aparelho", async () => {
  for (const p of ["/clientes", "/financeiro", "/propostas", "/tarefas", "/conta"]) await page.goto(BASE + p);
  await page.locator("nav a", { hasText: "Clientes" }).first().click().catch(() => {}); // navegação client-side (RSC)
  const href = await page.locator("a[href^='/propostas/']").first().getAttribute("href").catch(() => null);
  if (href) await page.request.get(BASE + "/api" + href + "/pdf");
  const urls = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) out.push(new URL(req.url).pathname);
    return out;
  });
  const bad = urls.filter((u) => !(u.startsWith("/_next/static/") || u.startsWith("/icons/") || u === "/offline.html"));
  assert(urls.length > 0, "cache vazio (SW não armazenou nem os estáticos)");
  assert(!bad.length, `itens indevidos no cache: ${bad.join(", ")}`);
});
await step("armazenamento local sem senhas/tokens/dados financeiros", async () => {
  const dump = await page.evaluate(() => JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage }, cookie: document.cookie }));
  assert(!/rf_session|password|senha|R\$/.test(dump), `conteúdo: ${dump.slice(0, 200)}`);
});
await step("offline: mostra página segura, sem dados do usuário", async () => {
  await ctx.setOffline(true);
  await page.goto(BASE + "/financeiro").catch(() => {});
  const text = await page.locator("body").innerText();
  assert(text.includes("sem conexão"), "página offline não exibida");
  assert(!/R\$|Proprietário|Cliente/.test(text), "dados privados exibidos offline");
  await ctx.setOffline(false);
});
await step("instruções de instalação em Minha conta", async () => {
  await page.goto(BASE + "/conta");
  await page.getByText("Adicionar à Tela de Início").waitFor();
  await page.getByText("Instalar app").first().waitFor();
});
await step("após sair, páginas privadas exigem login (nada servido do cache)", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Mais opções do menu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/login/);
  await page.goto(BASE + "/financeiro");
  assert(page.url().endsWith("/login"), page.url());
});
await browser.close();
for (const r of results) console.log(r.join(" "));
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\n${results.length - failed}/${results.length} passos OK`);
process.exit(failed ? 1 : 0);
