// Renderiza arte.html em quadros PNG (loop) ou em um still.
// Uso:
//   node render.mjs frames <pasta-saida> [fps=30] [segundos=8]
//   node render.mjs still  <arquivo.png> [escala=2] [t=0.12] [marca=1]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(here, 'arte.html')).href;
const [mode, out, a = '', b = '', c = ''] = process.argv.slice(2);

const browser = await chromium.launch();
try {
  if (mode === 'frames') {
    const fps = Number(a || 30), secs = Number(b || 8), n = fps * secs;
    fs.mkdirSync(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(`${page_url}?t=0`);
    await page.evaluate(() => window.ready);
    // Quadro n (t=1) é renderizado só para comparar com o quadro 0.
    for (let i = 0; i <= n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / n);
      const name = i === n ? 'seam_check.png' : `f_${String(i).padStart(5, '0')}.png`;
      await page.locator('#c').screenshot({ path: path.join(out, name) });
    }
    console.log(`${n} quadros em ${out}`);
  } else if (mode === 'still') {
    const scale = Number(a || 2), t = Number(b || 0.12), mark = c === '0' ? 0 : 1;
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(`${page_url}?t=${t}&scale=${scale}&mark=${mark}`);
    await page.evaluate(() => window.ready);
    const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`still ${1920 * scale}x${1080 * scale} em ${out}`);
  } else {
    console.error('modo desconhecido: use "frames" ou "still"');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
