// Teste ponta a ponta no navegador (Playwright). Requer o app rodando e um usuário proprietário.
// Uso: BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
import { createRequire } from "module";
import { mkdirSync } from "fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Defina E2E_EMAIL e E2E_PASSWORD"); process.exit(2); }
const SHOTS = new URL("./screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);
const results = [];
const errors = [];

async function step(name, fn) {
  try { await fn(); results.push(["✔", name]); }
  catch (e) { results.push(["✘", name, e.message.split("\n")[0]]); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text()}`); });

const go = async (path) => { const r = await page.goto(BASE + path); assert(r && r.status() < 400, `${path} status ${r?.status()}`); };
const submit = async () => { await page.locator("form button[type=submit]").last().click(); };
// mensagens de formulário (<p role=alert|status>) e avisos flutuantes; ignora o anunciador de rotas do Next
const toast = async (re) => {
  const loc = page.locator("p[role=alert], p[role=status], div.fixed[role=status]").filter({ hasText: re });
  try { return (await loc.first().textContent({ timeout: 10000 })) ?? ""; } catch { return ""; }
};
async function login(email, password) {
  await go("/login");
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click("button[type=submit]");
}

await step("redireciona para login sem sessão", async () => { await page.goto(BASE + "/financeiro"); assert(page.url().endsWith("/login"), page.url()); });
await step("login com senha errada mostra erro", async () => { await login(EMAIL, "senha-errada"); assert(await toast(/incorretos/), "sem mensagem"); });
await step("login do proprietário", async () => { await login(EMAIL, PASSWORD); await page.waitForURL(BASE + "/"); });

for (const p of ["/", "/clientes", "/funil", "/servicos", "/propostas", "/contratos", "/contratos/modelos", "/projetos", "/tarefas", "/financeiro", "/equipamentos", "/equipamentos/reservas", "/whatsapp", "/whatsapp/modelos", "/relatorios", "/usuarios", "/configuracoes", "/conta"]) {
  await step(`página ${p} carrega`, async () => { await go(p); assert(await page.locator("h1").count(), "sem título"); });
}

let clientUrl, proposalUrl;
await step("validação de formulário preserva dados", async () => {
  await go("/clientes/novo");
  await page.fill("#f-name", `Cliente E2E ${run}`); await page.fill("#f-email", "invalido");
  await submit();
  await page.locator("#f-email-err").waitFor();
  assert((await page.inputValue("#f-name")) === `Cliente E2E ${run}`, "nome perdido após erro");
});
await step("cria cliente", async () => {
  await page.fill("#f-email", `e2e-${run}@exemplo.invalid`); await page.fill("#f-whatsapp", "(11) 97777-0000");
  await submit(); await page.waitForURL(/\/clientes\/[0-9a-f-]{36}$/); clientUrl = page.url();
});
await step("registra contato no histórico", async () => {
  await page.fill("#f-summary", "Contato E2E"); await page.locator("form", { has: page.locator("#f-summary") }).locator("button[type=submit]").click();
  await page.getByText("Contato E2E").first().waitFor();
});
await step("cria oportunidade e move no funil", async () => {
  await go(`/funil/novo?cliente=${clientUrl.split("/").pop()}`);
  await page.fill("#f-title", `Oportunidade E2E ${run}`); await page.fill("#f-value", "5.000,00");
  await submit(); await page.waitForURL(/\/funil\/[0-9a-f-]{36}$/);
  await go("/funil");
  const card = page.locator("article", { hasText: `Oportunidade E2E ${run}` });
  await card.getByRole("button", { name: /Mover para Primeiro contato/ }).click();
  await page.locator("section[aria-label='Primeiro contato'] article", { hasText: `Oportunidade E2E ${run}` }).waitFor();
});
await step("cria proposta com itens e calcula total", async () => {
  await go(`/propostas/nova?cliente=${clientUrl.split("/").pop()}`);
  await page.fill("#f-title", `Proposta E2E ${run}`);
  await page.selectOption("#f-discount_type", "percentual"); await page.fill("#f-discount_value", "10");
  await submit(); await page.waitForURL(/\/propostas\/[0-9a-f-]{36}$/); proposalUrl = page.url();
  const add = async (desc, q, price) => {
    await page.fill("#f-description", desc); await page.fill("#f-quantity", q); await page.fill("#f-unit_price", price);
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByRole("cell", { name: desc }).waitFor();
  };
  await add("Captação E2E", "2", "1.000,00");
  await add("Edição E2E", "1", "500,50");
  const total = await page.locator("[data-testid=proposal-total]").textContent();
  assert(total.replace(/\s/g, " ").includes("2.250,45"), `total ${total}`);
});
await step("envia e aprova proposta; PDF gerado", async () => {
  await page.getByRole("button", { name: "Marcar como enviada" }).click();
  await page.getByRole("button", { name: "Aprovada pelo cliente" }).click();
  await page.getByText("Aprovada", { exact: true }).first().waitFor();
  const r = await page.request.get(proposalUrl.replace("/propostas/", "/api/propostas/") + "/pdf");
  assert(r.status() === 200 && r.headers()["content-type"] === "application/pdf" && (await r.body()).length > 1000, "PDF inválido");
});
await step("gera contrato a partir da proposta e PDF", async () => {
  await page.getByRole("link", { name: "Gerar contrato" }).click();
  await page.waitForURL(/contratos\/novo/); await submit(); await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
  assert((await page.inputValue("#f-body")).includes(`Cliente E2E ${run}`), "contratante não preenchido");
  const r = await page.request.get(page.url().replace("/contratos/", "/api/contratos/") + "/pdf");
  assert(r.status() === 200 && r.headers()["content-type"] === "application/pdf", "PDF inválido");
});
await step("cria produção e conta a receber a partir da proposta", async () => {
  await page.goto(proposalUrl);
  await page.getByRole("button", { name: "Lançar conta a receber" }).click();
  await page.getByText("Conta a receber criada").waitFor();
  await page.getByRole("button", { name: "Criar produção" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
});
await step("lança e quita despesa no financeiro", async () => {
  await go("/financeiro/novo?tipo=despesa");
  await page.fill("#f-description", `Despesa E2E ${run}`); await page.fill("#f-amount", "123,45");
  await submit(); await page.waitForURL(BASE + "/financeiro");
  const row = page.locator("tr", { hasText: `Despesa E2E ${run}` });
  await row.getByRole("button", { name: "Pago" }).click();
  await page.locator("tr", { hasText: `Despesa E2E ${run}` }).getByText("Pago", { exact: true }).waitFor();
});
await step("bloqueia reserva conflitante de equipamento", async () => {
  await go("/equipamentos/novo");
  await page.fill("#f-name", `Lente E2E ${run}`); await page.fill("#f-quantity", "1"); await page.fill("#f-daily_rate", "100");
  await submit(); await page.waitForURL(/\/equipamentos\/[0-9a-f-]{36}$/);
  const eq = page.url().split("/").pop();
  const reserve = async () => {
    await go(`/equipamentos/reservas/nova?equipamento=${eq}`);
    await page.fill("#f-start_at", "2031-05-10T10:00"); await page.fill("#f-end_at", "2031-05-12T10:00");
    await submit();
  };
  await reserve(); await page.waitForURL(/reservas\/[0-9a-f-]{36}$/);
  await reserve();
  assert(await toast(/Conflito de reserva/), "conflito não detectado");
});
await step("WhatsApp em modo teste apenas simula", async () => {
  await go(`/whatsapp?cliente=${clientUrl.split("/").pop()}`);
  await page.fill("#f-body", "Mensagem E2E"); await page.check("input[name=send_now]");
  await submit();
  assert(await toast(/janela de 24h/), "texto livre fora da janela deveria ser bloqueado");
  await page.selectOption("#f-template_id", { label: /retratil_followup/ }).catch(async () => {
    const v = await page.locator("#f-template_id option", { hasText: "retratil_followup" }).getAttribute("value");
    await page.selectOption("#f-template_id", v);
  });
  await page.fill("#f-params", "Cliente"); await page.check("input[name=send_now]");
  await submit();
  assert(await toast(/SIMULADA|não configurada/), "sem confirmação de simulação");
});
const userEmail = `comercial-${run}@exemplo.invalid`;
await step("proprietário cria usuário comercial", async () => {
  await go("/usuarios");
  await page.fill("#f-name", "Comercial E2E"); await page.fill("#f-email", userEmail); await page.fill("#f-password", "senha-e2e-123");
  await submit(); await page.getByRole("cell", { name: userEmail }).waitFor();
});
await step("screenshots desktop", async () => {
  await go("/"); await page.screenshot({ path: SHOTS + "desktop-dashboard.png", fullPage: true });
  await page.goto(proposalUrl); await page.screenshot({ path: SHOTS + "desktop-proposta.png", fullPage: true });
  await go("/funil"); await page.screenshot({ path: SHOTS + "desktop-funil.png" });
});
await step("logout", async () => { await page.getByRole("button", { name: "Sair" }).click(); await page.waitForURL(/login/); });
await step("perfil comercial não acessa financeiro nem usuários", async () => {
  await login(userEmail, "senha-e2e-123"); await page.waitForURL(BASE + "/");
  assert(!(await page.locator("nav a", { hasText: "Financeiro" }).count()), "menu exibe Financeiro");
  await page.goto(BASE + "/financeiro"); assert(page.url().endsWith("/sem-permissao"), page.url());
  await page.goto(BASE + "/usuarios"); assert(page.url().endsWith("/sem-permissao"), page.url());
  const r = await page.request.get(proposalUrl.replace("/propostas/", "/api/propostas/") + "/pdf");
  assert(r.status() === 200, "comercial deveria acessar PDF de proposta");
});

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.addCookies((await ctx.cookies()).map((c) => ({ ...c })));
const m = await mobile.newPage();
for (const p of ["/", "/clientes", "/funil", "/propostas", "/tarefas"]) {
  await step(`mobile ${p} sem rolagem horizontal`, async () => {
    await m.goto(BASE + p);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, `excede ${over}px`);
    await m.screenshot({ path: SHOTS + `mobile${p === "/" ? "-dashboard" : p.replace(/\//g, "-")}.png` });
  });
}
await step("menu mobile abre", async () => {
  await m.goto(BASE + "/"); await m.getByRole("button", { name: "Abrir menu" }).click();
  await m.getByRole("dialog").getByRole("link", { name: "Clientes" }).waitFor();
});

await browser.close();
for (const r of results) console.log(r.join(" "));
if (errors.length) { console.log("\nErros do navegador:"); for (const e of [...new Set(errors)]) console.log(" -", e); }
const failed = results.filter((r) => r[0] === "✘").length;
console.log(`\n${results.length - failed}/${results.length} passos OK`);
process.exit(failed || errors.length ? 1 : 0);
