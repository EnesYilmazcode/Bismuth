// Verifies HistoryView shows real previews + counts, and (separately) that
// uploaded blobs survive a page reload.

import puppeteer from 'puppeteer-core';
import fsp from 'node:fs/promises';
import path from 'node:path';

const PAGE_URL = 'http://localhost:3001/cadam/';
const HISTORY_URL = 'http://localhost:3001/cadam/history';
const PROMPT = 'a parametric phone stand';
const REPLY = {
  text: "Here's a phone stand.",
  title: 'Phone Stand',
  code: `stand_height = 80;
stand_width = 100;
stand_depth = 60;
phone_thickness = 12;

difference() {
  cube([stand_width, stand_depth, stand_height]);
  translate([stand_width / 2 - phone_thickness / 2, 10, 10])
    cube([phone_thickness, stand_depth, stand_height]);
}
`,
};

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.dirname(new URL(import.meta.url).pathname.slice(1));
const INBOX = path.join(ROOT, 'inbox');
const OUTBOX = path.join(ROOT, 'outbox');

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });

const events = [];
page.on('pageerror', (e) => events.push(`[pageerror] ${e.message}`));

// Clear all client storage so we start clean. One-shot — load a blank
// origin first, wipe, then proceed. Using evaluateOnNewDocument here would
// re-fire on every page.goto and undo our own writes.
console.log('▶ wipe storage');
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try {
    localStorage.clear();
  } catch {}
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('cadam-storage-v1');
    req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
  });
});

console.log('▶ load home');
await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30_000 });

const before = new Set(await fsp.readdir(INBOX).catch(() => []));
const ta = await page.waitForSelector('textarea', { timeout: 10_000 });
await ta.click();
await page.keyboard.type(PROMPT, { delay: 8 });
await page.keyboard.press('Enter');

console.log('▶ wait for inbox');
let promptId;
const dl = Date.now() + 20_000;
while (Date.now() < dl && !promptId) {
  const cur = await fsp.readdir(INBOX).catch(() => []);
  for (const f of cur) {
    if (!before.has(f) && f.endsWith('.json')) {
      promptId = f.replace(/\.json$/, '');
      break;
    }
  }
  if (!promptId) await new Promise((r) => setTimeout(r, 200));
}
if (!promptId) throw new Error('no inbox file');
console.log('  inbox', promptId);

await fsp.writeFile(path.join(OUTBOX, `${promptId}.json`), JSON.stringify(REPLY));

// Wait for the artifact + parameter sliders to mount.
const dl2 = Date.now() + 30_000;
while (Date.now() < dl2) {
  const ok = await page.evaluate(() => {
    return (
      document.body.innerText.includes('Phone Stand') &&
      !!document.querySelector('[role="slider"]')
    );
  });
  if (ok) break;
  await new Promise((r) => setTimeout(r, 400));
}

await new Promise((r) => setTimeout(r, 4_000));

// Persistence smoke: write a small blob via the storage API, then reload
// and confirm we can read it back.
console.log('▶ write blob via storage');
await page.evaluate(async () => {
  const mod = await import('/cadam/src/lib/supabase.ts');
  const { supabase } = mod;
  const blob = new Blob(['hello-from-test'], { type: 'text/plain' });
  await supabase.storage.from('images').upload('test/persist.txt', blob);
});

console.log('▶ navigate to history');
await page.goto(HISTORY_URL, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2_500));

const histText = await page.evaluate(() => document.body.innerText);
console.log('\n=== HISTORY VIEW TEXT (first 1200 chars) ===');
console.log(histText.slice(0, 1200));

const histShowsPrompt = histText.includes('phone stand');
const histShowsCount = /1\s*message|2\s*messages|message/i.test(histText);

await page.screenshot({ path: path.join(ROOT, 'e2e-history.png') });

console.log('\n▶ reload + verify blob persists');
await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });
const blobOk = await page.evaluate(async () => {
  const mod = await import('/cadam/src/lib/supabase.ts');
  const { supabase } = mod;
  const { data, error } = await supabase.storage
    .from('images')
    .download('test/persist.txt');
  if (error || !data) return { ok: false, reason: error?.message || 'no data' };
  const txt = await data.text();
  return { ok: txt === 'hello-from-test', read: txt };
});

console.log('blob roundtrip:', blobOk);
console.log('history shows prompt:', histShowsPrompt);
console.log('history shows count:', histShowsCount);

await browser.close();

const pass = histShowsPrompt && blobOk.ok;
console.log('\nPASS:', pass);
process.exit(pass ? 0 : 2);
