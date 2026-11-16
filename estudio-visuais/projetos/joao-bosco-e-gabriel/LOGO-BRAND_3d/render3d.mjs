// Renderiza cena.html (three.js) em quadros PNG, ou um still.
// Uso (a partir de qualquer pasta, com NODE_PATH apontando para o playwright global):
//   node render3d.mjs frames <pasta-saida> [fps=30] [segundos=8] [largura=1920] [altura=1080]
//   node render3d.mjs still  <arquivo.png> [t=0.12] [largura=1920] [altura=1080] [marca=1]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');          // estudio-visuais/
const rel = '/' + path.relative(root, path.join(here, 'cena.html')).split(path.sep).join('/');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}${rel}`;

const [mode, out, ...rest] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const open = async (w, h, qs) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto(`${base}?w=${w}&h=${h}&${qs}`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
    return page;
  };
  if (mode === 'frames') {
    const fps = Number(rest[0] || 30), secs = Number(rest[1] || 8), w = Number(rest[2] || 1920), h = Number(rest[3] || 1080);
    const n = fps * secs;
    fs.mkdirSync(out, { recursive: true });
    const page = await open(w, h, 't=0');
    for (let i = 0; i <= n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / n);
      const name = i === n ? 'seam_check.png' : `f_${String(i).padStart(5, '0')}.png`;
      await page.screenshot({ path: path.join(out, name) });
      if (i % 30 === 0) console.log(`quadro ${i}/${n}`);
    }
    console.log(`${n} quadros em ${out}`);
  } else if (mode === 'still') {
    const t = Number(rest[0] || 0.12), w = Number(rest[1] || 1920), h = Number(rest[2] || 1080), mark = rest[3] === '0' ? 0 : 1;
    const page = await open(w, h, `t=${t}&mark=${mark}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    console.log(`still ${w}x${h} em ${out}`);
  } else {
    console.error('modo desconhecido: use "frames" ou "still"');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.close();
}
