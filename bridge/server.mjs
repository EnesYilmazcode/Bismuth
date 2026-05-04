// Bridge server — pretends to be the Supabase Edge Functions that CADAM
// expects. The chat endpoints write the incoming request to bridge/inbox/
// and wait for a reply file to appear in bridge/outbox/. Claude (running
// in Claude Code) sees the inbox via a file watcher, reads the prompt,
// and writes the OpenSCAD reply.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import parseParameters from './parseParameter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INBOX = path.join(ROOT, 'inbox');
const OUTBOX = path.join(ROOT, 'outbox');
const PROCESSED = path.join(ROOT, 'processed');
for (const d of [INBOX, OUTBOX, PROCESSED]) fs.mkdirSync(d, { recursive: true });

const PORT = Number(process.env.BRIDGE_PORT || 8765);
const REPLY_TIMEOUT_MS = Number(process.env.BRIDGE_REPLY_TIMEOUT_MS || 600_000);
const POLL_INTERVAL_MS = 200;

const log = (...a) => console.log('[bridge]', ...a);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Expose-Headers': '*',
};

function send(res, status, body, extraHeaders = {}) {
  if (body === undefined || body === null) {
    res.writeHead(status, { ...CORS, ...extraHeaders });
    return res.end();
  }
  if (typeof body === 'string') {
    res.writeHead(status, {
      ...CORS,
      'Content-Type': 'text/plain; charset=utf-8',
      ...extraHeaders,
    });
    return res.end(body);
  }
  res.writeHead(status, {
    ...CORS,
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function waitForOutbox(id, signal) {
  const target = path.join(OUTBOX, `${id}.json`);
  const deadline = Date.now() + REPLY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('client disconnected');
    try {
      const raw = await fsp.readFile(target, 'utf8');
      // Move file out of outbox so we never re-deliver.
      const archived = path.join(PROCESSED, `${id}.reply.json`);
      await fsp.rename(target, archived).catch(() => {});
      return JSON.parse(raw);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('reply timeout');
}

function buildAssistantMessage(reply, ctx) {
  const code = (reply.code ?? '').trim();
  const title = reply.title || 'Adam Object';
  const text = reply.text;
  const content = { model: ctx.model };
  if (text) content.text = text;
  if (code) {
    const stripped = code
      .replace(/^```(?:openscad|scad)?\s*\n/, '')
      .replace(/\n?```\s*$/, '');
    content.artifact = {
      title,
      version: 'v1',
      code: stripped,
      parameters: parseParameters(stripped),
    };
  }
  return {
    id: ctx.newMessageId,
    conversation_id: ctx.conversationId,
    parent_message_id: ctx.messageId,
    role: 'assistant',
    rating: null,
    created_at: new Date().toISOString(),
    content,
  };
}

async function handleChat(req, res, mode) {
  const body = await readBody(req).catch(() => ({}));
  const id = body.newMessageId || cryptoRandomId();
  const ctx = {
    conversationId: body.conversationId || 'no-conv',
    messageId: body.messageId || null,
    newMessageId: id,
    model: body.model || 'unknown',
  };

  // Persist the inbox file so Claude can read full context.
  const inboxFile = path.join(INBOX, `${id}.json`);
  const payload = {
    id,
    mode,
    model: ctx.model,
    conversationId: ctx.conversationId,
    messageId: ctx.messageId,
    newMessageId: ctx.newMessageId,
    receivedAt: new Date().toISOString(),
    history: body.history || [],
    prompt: body.prompt || null,
  };
  await fsp.writeFile(inboxFile, JSON.stringify(payload, null, 2));

  // Loud, single-line stdout signal. Each line becomes one Monitor
  // notification, so this is what alerts Claude that a new prompt has
  // arrived. Keep it pithy + include enough to act on without re-reading
  // the file unless the prompt is long.
  const promptText = (body.prompt && body.prompt.text) || '(no text)';
  log(
    `PROMPT id=${id} mode=${mode} model=${ctx.model} text=${JSON.stringify(
      promptText.slice(0, 200),
    )}`,
  );

  // Stream response in the ND-JSON shape parametric-chat / creative-chat use.
  res.writeHead(200, {
    ...CORS,
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send a placeholder message so the UI shows a streaming bubble.
  const placeholder = {
    id,
    conversation_id: ctx.conversationId,
    parent_message_id: ctx.messageId,
    role: 'assistant',
    rating: null,
    created_at: new Date().toISOString(),
    content: { model: ctx.model, text: 'Thinking…' },
  };
  res.write(JSON.stringify(placeholder) + '\n');

  // Heartbeat updates while we wait for Claude. Each one keeps the bubble
  // alive and tells the user we haven't crashed.
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const dots = '.'.repeat(((Date.now() - startedAt) / 1500) % 4 | 0);
    const note = {
      ...placeholder,
      content: { model: ctx.model, text: `Thinking${dots}` },
    };
    try {
      res.write(JSON.stringify(note) + '\n');
    } catch {}
  }, 1500);

  let final;
  try {
    const reply = await waitForOutbox(id, req.signal);
    final = buildAssistantMessage(reply, ctx);
  } catch (e) {
    log('chat error:', e.message);
    final = {
      ...placeholder,
      content: {
        model: ctx.model,
        text: `Bridge error: ${e.message}`,
      },
    };
  } finally {
    clearInterval(heartbeat);
  }

  try {
    res.write(JSON.stringify(final) + '\n');
  } catch {}
  res.end();
}

function cryptoRandomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleTitleGenerator(req, res) {
  // Title-generator originally called Anthropic for a short title; here we
  // just take the first few words of the user prompt so each conversation
  // shows a distinct name in the sidebar.
  const body = await readBody(req).catch(() => ({}));
  const text =
    body?.content?.text ||
    body?.text ||
    (Array.isArray(body?.content?.images) && 'New image prompt') ||
    'Adam Object';
  const cleaned = String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 5)
    .join(' ');
  const title = cleaned.length > 27 ? cleaned.slice(0, 24) + '…' : cleaned;
  send(res, 200, { title: title || 'Adam Object' });
}

async function handleBillingStatus(_req, res) {
  send(res, 200, {
    user: { hasTrialed: true },
    subscription: { status: 'active', plan: 'free' },
    tokens: { total: 999_999, monthly: 999_999, addon: 0 },
  });
}

async function handleMesh(_req, res) {
  // We don't support real mesh generation. Return a helpful error so the
  // creative path doesn't hang silently.
  send(
    res,
    501,
    {
      error:
        'Mesh generation is not wired up in the local bridge. Use parametric mode (the default) — it is the OpenSCAD path Claude responds to.',
    },
  );
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;
  log(route);

  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true });

    if (url.pathname === '/functions/v1/parametric-chat')
      return handleChat(req, res, 'parametric');

    if (url.pathname === '/functions/v1/creative-chat')
      return handleChat(req, res, 'creative');

    if (url.pathname === '/functions/v1/title-generator')
      return handleTitleGenerator(req, res);

    if (url.pathname === '/functions/v1/billing-status')
      return handleBillingStatus(req, res);

    if (url.pathname === '/functions/v1/mesh') return handleMesh(req, res);

    if (url.pathname === '/functions/v1/prompt-generator')
      return send(res, 200, { prompt: 'Try: "a coffee mug with handle"' });

    if (
      url.pathname === '/functions/v1/jackson-pollock' ||
      url.pathname.startsWith('/functions/v1/jackson-pollock/')
    )
      // PostHog telemetry sink — silently absorb.
      return send(res, 200, { ok: true });

    if (url.pathname === '/functions/v1/billing-products') {
      // Callers (.find/.filter) expect an array of BillingProduct, not an object.
      return send(res, 200, []);
    }

    if (url.pathname.startsWith('/functions/v1/billing-')) {
      // billing-checkout, billing-portal: stub
      return send(res, 200, {});
    }

    // Catch-all: be loud about unmocked routes so we know what to add.
    log(`UNMOCKED ${route}`);
    send(res, 200, {});
  } catch (e) {
    log('handler error', e);
    if (!res.headersSent) send(res, 500, { error: e.message });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log(`inbox=${INBOX}`);
  log(`outbox=${OUTBOX}`);
});
