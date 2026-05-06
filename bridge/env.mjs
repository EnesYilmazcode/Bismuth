// Tiny .env.local loader. Avoids a dotenv dependency for one file's worth
// of work. Only honours `KEY=value` and `KEY="value"` lines, ignores blank
// lines and `#` comments. Existing process.env entries always win so
// shell-set values can override the file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq < 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!key) return null;
  return [key, value];
}

export function loadEnv() {
  const candidates = [
    path.join(REPO_ROOT, '.env.local'),
    path.join(REPO_ROOT, '.env'),
  ];
  for (const file of candidates) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const [k, v] = parsed;
      if (process.env[k] === undefined || process.env[k] === '') {
        process.env[k] = v;
      }
    }
  }
}
