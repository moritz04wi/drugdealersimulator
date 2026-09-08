/**
 * Rauchtest: startet das Spiel in einem echten Browser und prueft
 * Einkauf, Tap-Verkauf, Upgrades, Homies und den Spielstand.
 * Aufruf: npm test  (benoetigt playwright)
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { dirname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = joinPath(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  try {
    const buf = await readFile(join(ROOT, normalize(p)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(4173, r));

// Vorinstalliertes Chromium nutzen, falls Playwright keins mitbringt.
const preinstalled = process.env.PW_CHROMIUM
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:4173/index.html');
await page.waitForTimeout(800);

// Intro wegklicken -> landet im Einkauf
await page.click('#intro-ok');
await page.waitForTimeout(400);
console.log('Panel offen:', await page.locator('#panel').evaluate((e) => e.classList.contains('open')));
console.log('Panel-Titel:', await page.locator('#panel-title').textContent());
await page.screenshot({ path: '/tmp/dds-buy.png' });

// 10 g Bahnhofs-Gras kaufen
await page.click('[data-buy="bahnhof:10"]');
await page.waitForTimeout(300);
console.log('Nach Kauf ->', await page.evaluate(() => ({
  cash: Math.round(window.dds.game.state.cash),
  stock: window.dds.game.stockTotal,
})));

// Zurueck auf die Strasse, warten bis Kundschaft ansteht, dann antippen
await page.click('.tab[data-tab="street"]');
await page.waitForFunction(() => window.dds.game.customers.some((c) => c.phase === 'waiting'), null, { timeout: 15000 });
const before = await page.evaluate(() => window.dds.game.state.cash);
const pos = await page.evaluate(() => {
  const c = window.dds.game.customers.find((x) => x.phase === 'waiting');
  const r = document.getElementById('scene').getBoundingClientRect();
  return { x: r.left + c.x, y: r.top + c.y - 26, type: c.type, grams: c.grams };
});
await page.mouse.click(pos.x, pos.y);
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.dds.game.state.cash);
console.log(`Tap-Deal auf ${pos.type} (${pos.grams}g): Kasse ${before.toFixed(2)} -> ${after.toFixed(2)}`);
await page.screenshot({ path: '/tmp/dds-street.png' });

// Upgrades- und Sorten-Tab oeffnen
await page.evaluate(() => { window.dds.game.state.cash = 50000; window.dds.game.emit('change'); });
await page.click('.tab[data-tab="upgrades"]');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/dds-upgrades.png' });
await page.click('[data-upgrade="homie"]');
await page.click('.tab[data-tab="strains"]');
await page.waitForTimeout(300);
await page.click('[data-unlock="crack"]');
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/dds-strains.png' });
console.log('Upgrades/Sorten:', await page.evaluate(() => ({
  homies: window.dds.game.homies, unlocked: window.dds.game.state.unlocked,
})));

// Homies verkaufen automatisch weiter
await page.click('.tab[data-tab="street"]');
await page.evaluate(() => window.dds.game.buyStock('bahnhof', 200));
const dealsBefore = await page.evaluate(() => window.dds.game.state.deals);
await page.waitForTimeout(9000);
const dealsAfter = await page.evaluate(() => window.dds.game.state.deals);
console.log('Auto-Deals durch Homie in 9s:', dealsAfter - dealsBefore);

// Speichern + Neuladen
await page.evaluate(() => window.dds.game.save());
await page.reload();
await page.waitForTimeout(1200);
console.log('Nach Reload geladen:', await page.evaluate(() => ({
  cash: Math.round(window.dds.game.state.cash),
  deals: window.dds.game.state.deals,
  unlocked: window.dds.game.state.unlocked.length,
})));

// Service Worker registriert?
console.log('SW aktiv:', await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length)));
console.log('Konsolenfehler:', errors.length ? errors : 'keine');

await browser.close();
server.close();
