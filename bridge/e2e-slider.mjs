// Regression test for the "slider drag empties the chat + 3D viewer" bug.
// Submits a prompt, replies as Claude, then drags a parameter slider and
// asserts both the assistant message + artifact card are still on screen.

import puppeteer from 'puppeteer-core';
import fsp from 'node:fs/promises';
import path from 'node:path';

const PAGE_URL = 'http://localhost:3001/cadam/';
const PROMPT = 'a coffee mug';
const REPLY = {
  text: "Here's a coffee mug.",
  title: 'Coffee Mug',
  code: `mug_height = 100;       // [40:5:200]
mug_radius = 35;        // [20:60]
wall_thickness = 3;
mug_color = "SteelBlue";

color(mug_color)
difference() {
  cylinder(h = mug_height, r = mug_radius, $fn = 64);
  translate([0, 0, wall_thickness])
    cylinder(h = mug_height, r = mug_radius - wall_thickness, $fn = 64);
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
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('PostHog')) return;
  events.push(`[console.${m.type()}] ${t.slice(0, 300)}`);
});
page.on('pageerror', (e) => events.push(`[pageerror] ${e.message}`));

// Clear localStorage from previous runs so we get a clean conversation.
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.clear();
  } catch {}
});

console.log('▶ load page');
await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30_000 });

const before = new Set(await fsp.readdir(INBOX).catch(() => []));

console.log('▶ submit prompt');
const ta = await page.waitForSelector('textarea', { timeout: 10_000 });
await ta.click();
await page.keyboard.type(PROMPT, { delay: 8 });
await page.keyboard.press('Enter');

console.log('▶ wait for inbox');
let promptId;
const dl = Date.now() + 20_000;
while (Date.now() < dl) {
  const cur = await fsp.readdir(INBOX).catch(() => []);
  for (const f of cur) {
    if (!before.has(f) && f.endsWith('.json')) {
      promptId = f.replace(/\.json$/, '');
      break;
    }
  }
  if (promptId) break;
  await new Promise((r) => setTimeout(r, 200));
}
if (!promptId) throw new Error('no inbox file');
console.log('  inbox', promptId);

console.log('▶ write reply');
await fsp.writeFile(path.join(OUTBOX, `${promptId}.json`), JSON.stringify(REPLY));

console.log('▶ wait for artifact + slider');
const artifactDl = Date.now() + 30_000;
let foundSlider = false;
while (Date.now() < artifactDl) {
  foundSlider = await page
    .evaluate(() => {
      const txt = document.body.innerText;
      const slider = document.querySelector('[role="slider"]');
      return txt.includes('Coffee Mug') && !!slider;
    })
    .catch(() => false);
  if (foundSlider) break;
  await new Promise((r) => setTimeout(r, 400));
}
if (!foundSlider) throw new Error('artifact / slider never appeared');

// Let WASM compile + initial render finish so we don't race the slider drag.
await new Promise((r) => setTimeout(r, 5_000));

// Snapshot pre-drag state.
const preText = await page.evaluate(() => document.body.innerText);
const preHasMug = /Coffee Mug/.test(preText);
const preHasUserMsg = /a coffee mug/i.test(preText);
console.log('▶ pre-drag', { mug: preHasMug, userMsg: preHasUserMsg });
await page.screenshot({ path: path.join(ROOT, 'e2e-slider-pre.png') });

// Drag the first slider thumb. role=slider thumbs respond to keyboard events
// in shadcn/Radix sliders, which trigger onValueChange and onValueCommit
// reliably in headless mode.
console.log('▶ drag slider');
await page.focus('[role="slider"]');
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('ArrowRight');
  await new Promise((r) => setTimeout(r, 60));
}
// Tab away to trigger onValueCommit (Radix commits on blur if the value moved).
await page.keyboard.press('Tab');

// Wait for the parameter-update mutation to settle (200ms debounce + invalidation).
await new Promise((r) => setTimeout(r, 2_500));

const postText = await page.evaluate(() => document.body.innerText);
const postHasMug = /Coffee Mug/.test(postText);
const postHasUserMsg = /a coffee mug/i.test(postText);
console.log('▶ post-drag', { mug: postHasMug, userMsg: postHasUserMsg });
await page.screenshot({ path: path.join(ROOT, 'e2e-slider-post.png') });

console.log('\n=== EVENTS ===');
for (const e of events.slice(-12)) console.log(e);

console.log('\n=== POST-DRAG VISIBLE TEXT (first 1500 chars) ===');
console.log(postText.slice(0, 1500));

const ok = postHasMug && postHasUserMsg;
console.log('\nPASS:', ok);
await browser.close();
process.exit(ok ? 0 : 2);
