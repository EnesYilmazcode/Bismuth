// Headless smoke test using Edge + puppeteer-core. Captures console output
// + page errors so we can see why the React app is crashing without needing
// the user to copy/paste from devtools.

import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://localhost:3001/cadam/';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
const events = [];

page.on('console', (m) => {
  events.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => {
  events.push(`[pageerror] ${e.message}\n${e.stack || ''}`);
});
page.on('requestfailed', (req) => {
  events.push(
    `[requestfailed] ${req.method()} ${req.url()} ${
      req.failure()?.errorText
    }`,
  );
});
page.on('response', (res) => {
  if (res.status() >= 400) {
    events.push(`[response ${res.status()}] ${res.request().method()} ${res.url()}`);
  }
});

console.log('Loading', URL);
try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
} catch (e) {
  events.push(`[goto failed] ${e.message}`);
}

// Give react-query a moment to settle.
await new Promise((r) => setTimeout(r, 2500));

// Snapshot what's visible.
const visibleText = await page
  .evaluate(() => document.body.innerText.slice(0, 2000))
  .catch(() => '(eval failed)');

console.log('\n=== EVENTS ===');
for (const e of events) console.log(e);
console.log('\n=== VISIBLE TEXT ===');
console.log(visibleText);

await browser.close();
