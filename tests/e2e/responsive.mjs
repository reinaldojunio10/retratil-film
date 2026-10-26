// Auditoria de layout responsivo (Playwright/Chromium com emulação de dispositivos).
// Uso: BASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... node tests/e2e/responsive.mjs
import { createRequire } from "module";
import { mkdirSync } from "fs";
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = new URL("./screenshots/responsive/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = [
  { name: "android-360", ...devices["Galaxy S9+"], viewport: { width: 360, height: 740 } },
  { name: "android-412", ...devices["Pixel 7"] },
  { name: "iphone-390", ...devices["iPhone 13"] },
  { name: "tablet-768", ...devices["iPad Mini"] },
  { name: "laptop-1024", viewport: { width: 1024, height: 768 } },
  { name: "desktop-1366", viewport: { width: 1366, height: 900 } },
];
const STATIC = ["/", "/clientes", "/clientes/novo", "/funil", "/funil/novo", "/servicos", "/propostas", "/propostas/nova", "/contratos", "/contratos/novo",
  "/contratos/modelos", "/projetos", "/projetos/novo", "/tarefas", "/tarefas/nova", "/financeiro", "/financeiro/novo", "/equipamentos",
  "/equipamentos/reservas", "/equipamentos/reservas/nova", "/whatsapp", "/whatsapp/modelos", "/relatorios", "/usuarios", "/configuracoes", "/conta"];

const browser = await chromium.launch();
const login = await browser.newContext();
const lp = await login.newPage();
await lp.goto(BASE + "/login");
await lp.fill("#email", process.env.E2E_EMAIL); await lp.fill("#password", process.env.E2E_PASSWORD);
await lp.click("button[type=submit]"); await lp.waitForURL(BASE + "/");
// páginas de detalhe: primeiro registro de cada lista
const detail = [];
for (const [list, re] of [["/clientes", /^\/clientes\/[0-9a-f-]{36}$/], ["/propostas", /^\/propostas\/[0-9a-f-]{36}$/], ["/contratos", /^\/contratos\/[0-9a-f-]{36}$/],
  ["/projetos?status=", /^\/projetos\/[0-9a-f-]{36}$/], ["/funil", /^\/funil\/[0-9a-f-]{36}$/], ["/financeiro?de=2000-01-01&ate=2100-01-01", /^\/financeiro\/[0-9a-f-]{36}$/],
  ["/equipamentos", /^\/equipamentos\/[0-9a-f-]{36}$/], ["/tarefas?filtro=todas", /^\/tarefas\/[0-9a-f-]{36}$/]]) {
  await lp.goto(BASE + list);
  const hrefs = await lp.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  const h = hrefs.find((x) => re.test(x)); if (h) detail.push(h);
}
const cookies = await login.cookies();
const PAGES = [...STATIC, ...detail];
const problems = [];
let checks = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ ...vp, viewport: vp.viewport });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  let current = "";
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${vp.name}] ${current}: erro no console: ${m.text().slice(0, 120)}`); });
  page.on("pageerror", (e) => problems.push(`[${vp.name}] ${current}: erro de página: ${e.message.slice(0, 120)}`));
  const mobile = vp.viewport.width < 768;
  for (const p of PAGES) {
    current = p;
    await page.goto(BASE + p);
    checks++;
    const r = await page.evaluate(({ mobile, W }) => {
      const out = [];
      // compara com a largura REAL do aparelho: em emulação móvel, innerWidth "estica" quando há conteúdo largo
      if (window.innerWidth > W + 1) out.push(`página mais larga que a tela (${window.innerWidth}px > ${W}px): o navegador reduz o zoom`);
      if (document.documentElement.scrollWidth > W + 1) out.push(`rolagem horizontal da página (${document.documentElement.scrollWidth}px > ${W}px)`);
      const inScroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth) return e; } return null; };
      // conteúdo propositalmente truncado (ancestral com overflow oculto dentro da tela) não conta como corte
      const clipped = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX === "hidden" && e.getBoundingClientRect().right <= W + 1) return true; } return false; };
      const scrollers = new Set();
      for (const el of document.querySelectorAll("main *")) {
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > W + 1 && !inScroller(el) && !clipped(el)) { out.push(`cortado: <${el.tagName.toLowerCase()} class="${(el.className?.baseVal ?? el.className ?? "").toString().slice(0, 50)}">`); break; }
        const sc = inScroller(el); if (sc && !sc.dataset.scrollOk) scrollers.add(sc);
      }
      for (const sc of scrollers) out.push(`rolagem horizontal interna: <${sc.tagName.toLowerCase()} class="${sc.className.toString().slice(0, 50)}">`);
      if (mobile) {
        for (const sc of []) out.push(`rolagem horizontal interna: <${sc.tagName.toLowerCase()} class="${sc.className.toString().slice(0, 50)}">`);
        const small = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]), select, textarea")].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16);
        if (small.length) out.push(`${small.length} campo(s) com fonte < 16px (zoom automático no iPhone)`);
        const tiny = [...document.querySelectorAll("main button, main a.btn, main select, main input:not([type=hidden]):not([type=checkbox]), header button, nav a")]
          .filter((b) => { const rc = b.getBoundingClientRect(); return rc.width > 0 && rc.height < 40; });
        if (tiny.length) out.push(`${tiny.length} alvo(s) de toque < 40px de altura (ex.: "${(tiny[0].textContent || tiny[0].getAttribute("aria-label") || tiny[0].tagName).trim().slice(0, 30)}")`);
      }
      return out;
    }, { mobile, W: vp.viewport.width });
    for (const x of [...new Set(r)]) problems.push(`[${vp.name}] ${p}: ${x}`);
  }
  for (const p of ["/", "/clientes", "/propostas", "/funil", "/financeiro", detail[1] ?? "/propostas"]) {
    await page.goto(BASE + p);
    await page.screenshot({ path: `${SHOTS}${vp.name}${p.replace(/[/?=&]/g, "_").slice(0, 40) || "_"}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(problems.join("\n"));
console.log(`\n${checks} combinações página×largura verificadas; ${problems.length} problema(s).`);
process.exit(problems.length ? 1 : 0);
