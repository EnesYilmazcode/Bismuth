// End-to-end smoke: load page, type a prompt, submit, watch the bridge
// inbox for the request, drop a reply file in outbox, then verify the
// frontend renders the artifact.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const PAGE_URL = process.argv[2] || 'http://localhost:3001/cadam/';
const PROMPT = process.argv[3] || 'a coffee mug';
const REPLY = {
  text: "Here's a coffee mug.",
  title: 'Coffee Mug',
  code: `// Coffee mug with handle
mug_height = 100;       // [40:5:200]
mug_radius = 35;        // [20:60]
wall_thickness = 3;
handle_outer = 28;      // [15:50]
handle_inner = 18;      // [8:40]
mug_color = "SteelBlue";

color(mug_color)
difference() {
  union() {
    cylinder(h = mug_height, r = mug_radius);
    translate([mug_radius - 4, 0, mug_height / 2])
      rotate([90, 0, 0])
      torus(handle_outer, handle_inner);
  }
  translate([0, 0, wall_thickness])
    cylinder(h = mug_height, r = mug_radius - wall_thickness);
}

module torus(r1, r2) {
  rotate_extrude($fn = 80)
    translate([r1, 0, 0])
    circle(r = (r1 - r2) / 2, $fn = 32);
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
  events.push(`[console.${m.type()}] ${t.slice(0, 400)}`);
});
page.on('pageerror', (e) => events.push(`[pageerror] ${e.message}`));

console.log('▶ load', PAGE_URL);
await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

// Snapshot the inbox before submitting so we can detect the new file.
const before = new Set(await fsp.readdir(INBOX).catch(() => []));

// Find the chat textarea and type into it.
console.log('▶ type prompt:', JSON.stringify(PROMPT));
const textarea = await page.waitForSelector('textarea', { timeout: 10000 });
await textarea.click();
await page.keyboard.type(PROMPT, { delay: 10 });

// Submit. The component likely accepts Enter or has a submit button.
// Try Enter first; fall back to clicking the most prominent button.
console.log('▶ submit');
await page.keyboard.press('Enter');

// Watch inbox for a new file.
console.log('▶ wait for inbox file');
let promptId;
const dl = Date.now() + 30_000;
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
if (!promptId) {
  console.log('✗ no inbox file appeared');
  console.log('events:', events.join('\n'));
  await browser.close();
  process.exit(1);
}
console.log('✓ inbox', promptId);

const inbox = JSON.parse(
  await fsp.readFile(path.join(INBOX, `${promptId}.json`), 'utf8'),
);
console.log('  prompt.text =', JSON.stringify(inbox.prompt?.text));

// Reply to the bridge.
console.log('▶ writing outbox reply');
await fsp.writeFile(
  path.join(OUTBOX, `${promptId}.json`),
  JSON.stringify(REPLY),
);

// Wait for the artifact to render.
console.log('▶ wait for artifact');
const artifactDl = Date.now() + 30_000;
let artifactSeen = false;
while (Date.now() < artifactDl) {
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (txt.includes('Coffee Mug') || txt.includes('coffee mug')) {
    artifactSeen = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}

// Give OpenSCAD WASM time to compile + render the 3D model.
console.log('▶ wait 12s for OpenSCAD WASM compile');
await new Promise((r) => setTimeout(r, 12_000));

const finalText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
const finalUrl = page.url();
console.log('\n=== EVENTS ===');
for (const e of events) console.log(e);
console.log('\n=== URL ===', finalUrl);
console.log('\n=== VISIBLE TEXT ===');
console.log(finalText);
console.log('\nartifact rendered?', artifactSeen);

await page.screenshot({ path: path.join(ROOT, 'e2e-screenshot.png'), fullPage: true });
console.log('screenshot:', path.join(ROOT, 'e2e-screenshot.png'));

await browser.close();
process.exit(artifactSeen ? 0 : 2);
