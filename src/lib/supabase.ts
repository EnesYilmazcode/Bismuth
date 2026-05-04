// Local mock of @supabase/supabase-js. The original CADAM relies on a real
// Supabase project (auth + Postgres + Realtime + Storage + Edge Functions);
// in this fork the model behind the chat is Claude itself, talking through
// a tiny bridge server. So we replace the live client with an in-browser
// fake that:
//   - returns a constant fake authenticated user
//   - persists rows for `conversations`, `messages`, `meshes`, `images`,
//     `profiles` etc. to localStorage
//   - keeps uploaded image / mesh blobs in memory (per page session)
//   - turns realtime subscriptions and edge-function side-channels into
//     no-ops, except `functions.invoke()` which forwards to the bridge
//
// Anything not implemented degrades to a no-op success rather than throwing,
// because the original code paths are not always defensive.

// We deliberately do not import the real createClient — the Database type is
// only used for compile-time inference in the rest of the app; runtime is
// fully ours.
import { Database } from '@shared/database';

export const isSupabaseConfigMissing = false;

// ---- bridge URL ------------------------------------------------------------
const BRIDGE_URL = (
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8765'
).replace(/\/$/, '');

// ---- fake user / session ---------------------------------------------------
const FAKE_USER_ID = '00000000-0000-4000-8000-000000000001';
const FAKE_USER = {
  id: FAKE_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'you@local.dev',
  email_confirmed_at: new Date(0).toISOString(),
  phone: '',
  confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date(0).toISOString(),
  app_metadata: { provider: 'local', providers: ['local'] },
  user_metadata: { full_name: 'Local User' },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} as const;

const FAKE_SESSION = {
  access_token: 'local-bridge-token',
  refresh_token: 'local-bridge-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: FAKE_USER,
} as const;

// ---- in-browser table store ------------------------------------------------
type Row = Record<string, unknown>;
const STORAGE_KEY = 'cadam-mock-db-v1';

function loadDB(): Record<string, Row[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return seed();
    // Ensure seed tables exist.
    return { ...seed(), ...parsed };
  } catch {
    return seed();
  }
}

function seed(): Record<string, Row[]> {
  return {
    profiles: [
      {
        id: FAKE_USER_ID,
        user_id: FAKE_USER_ID,
        full_name: 'Local User',
        notifications_enabled: false,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    conversations: [],
    messages: [],
    meshes: [],
    images: [],
    user_extradata: [
      { user_id: FAKE_USER_ID, prompts_used: 0, prompts_limit: 999_999 },
    ],
  };
}

let DB = loadDB();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  } catch {
    // localStorage may be unavailable (private mode, quota); ignore.
  }
}

function table(name: string): Row[] {
  if (!DB[name]) DB[name] = [];
  return DB[name];
}

// ---- query builder ---------------------------------------------------------
type Filter =
  | { kind: 'eq'; col: string; val: unknown }
  | { kind: 'neq'; col: string; val: unknown }
  | { kind: 'in'; col: string; vals: unknown[] }
  | { kind: 'is'; col: string; val: unknown }
  | { kind: 'gt'; col: string; val: number }
  | { kind: 'gte'; col: string; val: number }
  | { kind: 'lt'; col: string; val: number }
  | { kind: 'lte'; col: string; val: number };

type Op =
  | { kind: 'select'; cols: string }
  | { kind: 'insert'; rows: Row[] }
  | { kind: 'update'; patch: Row }
  | { kind: 'upsert'; rows: Row[]; opts: { onConflict?: string; ignoreDuplicates?: boolean } }
  | { kind: 'delete' };

class QueryBuilder<T = Row> implements PromiseLike<{ data: T | T[] | null; error: Error | null }> {
  private op: Op = { kind: 'select', cols: '*' };
  private filters: Filter[] = [];
  private sort?: { col: string; ascending: boolean };
  private limitN?: number;
  private oneOf?: 'single' | 'maybeSingle';

  constructor(private tableName: string) {}

  select(cols = '*') {
    if (this.op.kind === 'select') this.op = { kind: 'select', cols };
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }
  update(patch: Row) {
    this.op = { kind: 'update', patch };
    return this;
  }
  upsert(
    rows: Row | Row[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ) {
    this.op = {
      kind: 'upsert',
      rows: Array.isArray(rows) ? rows : [rows],
      opts,
    };
    return this;
  }
  delete() {
    this.op = { kind: 'delete' };
    return this;
  }

  // filters
  eq(col: string, val: unknown) {
    this.filters.push({ kind: 'eq', col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: 'neq', col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ kind: 'in', col, vals });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ kind: 'is', col, val });
    return this;
  }
  gt(col: string, val: number) {
    this.filters.push({ kind: 'gt', col, val });
    return this;
  }
  gte(col: string, val: number) {
    this.filters.push({ kind: 'gte', col, val });
    return this;
  }
  lt(col: string, val: number) {
    this.filters.push({ kind: 'lt', col, val });
    return this;
  }
  lte(col: string, val: number) {
    this.filters.push({ kind: 'lte', col, val });
    return this;
  }
  // postgrest-style filter; we only use it for safety, not expressiveness.
  filter() {
    return this;
  }
  match(criteria: Record<string, unknown>) {
    for (const [col, val] of Object.entries(criteria)) {
      this.filters.push({ kind: 'eq', col, val });
    }
    return this;
  }

  order(col: string, opts: { ascending?: boolean } = {}) {
    this.sort = { col, ascending: opts.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.limitN = to - from + 1;
    return this;
  }
  single() {
    this.oneOf = 'single';
    return this;
  }
  maybeSingle() {
    this.oneOf = 'maybeSingle';
    return this;
  }
  // The Supabase JS client uses overrideTypes() for compile-time type narrowing
  // — runtime no-op.
  overrideTypes<U>() {
    return this as unknown as QueryBuilder<U>;
  }

  // ---- executor ----
  private applyFilters(rows: Row[]) {
    return rows.filter((row) => {
      for (const f of this.filters) {
        const v = row[f.col];
        switch (f.kind) {
          case 'eq':
            if (v !== f.val) return false;
            break;
          case 'neq':
            if (v === f.val) return false;
            break;
          case 'in':
            if (!f.vals.includes(v)) return false;
            break;
          case 'is':
            // Used like `.is('parent_message_id', null)` — match strict equality
            // including undefined/null.
            if ((v ?? null) !== (f.val ?? null)) return false;
            break;
          case 'gt':
            if (!(typeof v === 'number' && v > f.val)) return false;
            break;
          case 'gte':
            if (!(typeof v === 'number' && v >= f.val)) return false;
            break;
          case 'lt':
            if (!(typeof v === 'number' && v < f.val)) return false;
            break;
          case 'lte':
            if (!(typeof v === 'number' && v <= f.val)) return false;
            break;
        }
      }
      return true;
    });
  }

  private async run(): Promise<{ data: unknown; error: Error | null }> {
    const t = table(this.tableName);
    try {
      let result: Row[] = [];
      const op = this.op;

      if (op.kind === 'select') {
        result = this.applyFilters(t).map((r) => ({ ...r }));
        if (this.sort) {
          const { col, ascending } = this.sort;
          result.sort((a, b) => {
            const av = a[col];
            const bv = b[col];
            if (av == null && bv == null) return 0;
            if (av == null) return ascending ? -1 : 1;
            if (bv == null) return ascending ? 1 : -1;
            if (av < bv) return ascending ? -1 : 1;
            if (av > bv) return ascending ? 1 : -1;
            return 0;
          });
        }
        if (this.limitN != null) result = result.slice(0, this.limitN);
        // Hydrate Postgrest-style embedded selects on conversations rows
        // (e.g. `*, first_message:messages(content), messagesCount:messages(count)`)
        // — the real backend joins these in one round-trip; in the mock we
        // do a small follow-up scan over the messages table.
        if (
          this.tableName === 'conversations' &&
          op.cols &&
          (op.cols.includes('first_message') ||
            op.cols.includes('messagesCount'))
        ) {
          const messages = table('messages');
          const wantsFirst = op.cols.includes('first_message');
          const wantsCount = op.cols.includes('messagesCount');
          for (const row of result) {
            const convId = row.id;
            const ofConv = messages.filter(
              (m) => m.conversation_id === convId,
            );
            if (wantsFirst) {
              const sorted = [...ofConv].sort((a, b) => {
                const at = String(a.created_at ?? '');
                const bt = String(b.created_at ?? '');
                return at < bt ? -1 : at > bt ? 1 : 0;
              });
              row.first_message = sorted[0]
                ? [{ content: sorted[0].content }]
                : [];
            }
            if (wantsCount) {
              row.messagesCount = [{ count: ofConv.length }];
            }
          }
        }
      } else if (op.kind === 'insert') {
        const inserted: Row[] = [];
        for (const row of op.rows) {
          const r = withDefaults(this.tableName, row);
          t.push(r);
          inserted.push({ ...r });
        }
        persist();
        result = inserted;
      } else if (op.kind === 'update') {
        const matched = this.applyFilters(t);
        for (const row of matched) {
          Object.assign(row, op.patch, {
            updated_at: new Date().toISOString(),
          });
        }
        persist();
        result = matched.map((r) => ({ ...r }));
      } else if (op.kind === 'upsert') {
        const conflictCol = op.opts.onConflict || 'id';
        const inserted: Row[] = [];
        for (const row of op.rows) {
          const existingIdx = t.findIndex(
            (r) => r[conflictCol] === row[conflictCol],
          );
          if (existingIdx >= 0) {
            if (!op.opts.ignoreDuplicates) {
              Object.assign(t[existingIdx], row);
            }
            inserted.push({ ...t[existingIdx] });
          } else {
            const r = withDefaults(this.tableName, row);
            t.push(r);
            inserted.push({ ...r });
          }
        }
        persist();
        result = inserted;
      } else if (op.kind === 'delete') {
        const matched = this.applyFilters(t);
        for (const row of matched) {
          const idx = t.indexOf(row);
          if (idx >= 0) t.splice(idx, 1);
        }
        persist();
        result = matched.map((r) => ({ ...r }));
      }

      if (this.oneOf === 'single') {
        if (result.length === 0) {
          return { data: null, error: new Error('No rows') };
        }
        return { data: result[0], error: null };
      }
      if (this.oneOf === 'maybeSingle') {
        return { data: result[0] ?? null, error: null };
      }
      return { data: result, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((v: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return this.run().then(onfulfilled, onrejected) as Promise<TResult1 | TResult2>;
  }
}

function withDefaults(tableName: string, row: Row): Row {
  const now = new Date().toISOString();
  const out: Row = { ...row };
  if (!('id' in out) || out.id == null) {
    out.id = crypto.randomUUID();
  }
  if (!('created_at' in out) || out.created_at == null) out.created_at = now;
  if (tableName === 'messages') {
    if (out.rating === undefined) out.rating = null;
  }
  if (tableName === 'conversations') {
    if (out.updated_at === undefined) out.updated_at = now;
    if (out.user_id === undefined) out.user_id = FAKE_USER_ID;
  }
  return out;
}

// ---- storage (IndexedDB-backed blobs, in-memory L1 cache) -----------------
// Storage is backed by IndexedDB so uploaded reference images / mesh files
// survive a page reload. The in-memory `blobStore` is the hot-path cache —
// reads check it first, fall through to IDB, and back-fill on hit.

const blobStore = new Map<string, Blob>();
const objectUrls = new Map<string, string>();

const IDB_NAME = 'cadam-storage-v1';
const IDB_STORE = 'blobs';
let idbPromise: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

async function idbGet(path: string): Promise<Blob | undefined> {
  try {
    const db = await openIdb();
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(path);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbPut(path: string, blob: Blob): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Persistence is best-effort. In-memory cache still serves this session.
  }
}

async function idbDelete(path: string): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort
  }
}

async function getBlob(filePath: string): Promise<Blob | undefined> {
  const cached = blobStore.get(filePath);
  if (cached) return cached;
  const fromIdb = await idbGet(filePath);
  if (fromIdb) blobStore.set(filePath, fromIdb);
  return fromIdb;
}

function urlFor(filePath: string, blob: Blob): string {
  let url = objectUrls.get(filePath);
  if (!url) {
    url = URL.createObjectURL(blob);
    objectUrls.set(filePath, url);
  }
  return url;
}

function makeStorageBucket(_bucket: string) {
  return {
    async upload(
      filePath: string,
      file: Blob | ArrayBuffer | File,
      _opts?: unknown,
    ) {
      const blob =
        file instanceof Blob
          ? file
          : new Blob([file as BlobPart], { type: 'application/octet-stream' });
      blobStore.set(filePath, blob);
      // Drop any stale object URL — a different blob on the same path would
      // otherwise keep serving the old bytes from cache.
      const old = objectUrls.get(filePath);
      if (old) {
        URL.revokeObjectURL(old);
        objectUrls.delete(filePath);
      }
      await idbPut(filePath, blob);
      return { data: { path: filePath }, error: null };
    },
    async download(filePath: string) {
      const b = await getBlob(filePath);
      if (!b) return { data: null, error: new Error('not found') };
      return { data: b, error: null };
    },
    async remove(paths: string[]) {
      for (const p of paths) {
        blobStore.delete(p);
        const url = objectUrls.get(p);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrls.delete(p);
        }
        await idbDelete(p);
      }
      return { data: null, error: null };
    },
    async list() {
      return { data: [], error: null };
    },
    async createSignedUrl(filePath: string, _expires: number) {
      const b = await getBlob(filePath);
      if (!b) return { data: null, error: new Error('not found') };
      return { data: { signedUrl: urlFor(filePath, b) }, error: null };
    },
    async createSignedUrls(filePaths: string[], _expires: number) {
      const out = await Promise.all(
        filePaths.map(async (p) => {
          const b = await getBlob(p);
          if (!b) return { path: p, signedUrl: '', error: 'not found' };
          return { path: p, signedUrl: urlFor(p, b), error: null };
        }),
      );
      return { data: out, error: null };
    },
    async copy(src: string, dst: string) {
      const b = await getBlob(src);
      if (!b) return { data: null, error: new Error('not found') };
      blobStore.set(dst, b);
      await idbPut(dst, b);
      return { data: { path: dst }, error: null };
    },
    async move(src: string, dst: string) {
      const b = await getBlob(src);
      if (!b) return { data: null, error: new Error('not found') };
      blobStore.set(dst, b);
      await idbPut(dst, b);
      blobStore.delete(src);
      await idbDelete(src);
      const oldUrl = objectUrls.get(src);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        objectUrls.delete(src);
      }
      return { data: { path: dst }, error: null };
    },
    getPublicUrl(filePath: string) {
      // Sync API — only reflects what's already in the L1 cache. Callers that
      // need a guaranteed URL after reload should use createSignedUrl.
      const b = blobStore.get(filePath);
      return { data: { publicUrl: b ? urlFor(filePath, b) : '' } };
    },
  };
}

// ---- realtime channel (no-op) ---------------------------------------------
function makeChannel(_name: string) {
  const channel = {
    on(_type: string, _filter: unknown, _cb?: (...a: unknown[]) => void) {
      return channel;
    },
    subscribe(_cb?: (...a: unknown[]) => void) {
      // Pretend we subscribed successfully.
      try {
        _cb?.('SUBSCRIBED');
      } catch {
        // Ignore — callers don't always pass a handler.
      }
      return {
        unsubscribe() {
          return Promise.resolve('ok');
        },
      };
    },
    send(_payload: unknown) {
      return Promise.resolve('ok');
    },
    unsubscribe() {
      return Promise.resolve('ok');
    },
  };
  return channel;
}

// ---- functions.invoke -----------------------------------------------------
async function invokeFunction(name: string, opts: { body?: unknown } = {}) {
  try {
    const res = await fetch(`${BRIDGE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.body ?? {}),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      return { data: null, error: new Error(`HTTP ${res.status}`) };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// ---- the client ------------------------------------------------------------
type AuthChangeCallback = (event: string, session: typeof FAKE_SESSION | null) => void;
const authListeners = new Set<AuthChangeCallback>();

function fireAuthChange(event: string) {
  for (const cb of authListeners) {
    try {
      cb(event, FAKE_SESSION);
    } catch {
      // Listener errors must not break sibling listeners.
    }
  }
}

const auth = {
  async getUser() {
    return { data: { user: FAKE_USER }, error: null };
  },
  async getSession() {
    return { data: { session: FAKE_SESSION }, error: null };
  },
  async refreshSession() {
    return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null };
  },
  async signInWithPassword(_creds: { email: string; password: string }) {
    setTimeout(() => fireAuthChange('SIGNED_IN'), 0);
    return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null };
  },
  async signUp(_creds: { email: string; password: string }) {
    setTimeout(() => fireAuthChange('SIGNED_IN'), 0);
    return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null };
  },
  async signInWithOtp(_creds: { email: string }) {
    setTimeout(() => fireAuthChange('SIGNED_IN'), 0);
    return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null };
  },
  async verifyOtp(_creds: { email: string; token: string }) {
    setTimeout(() => fireAuthChange('SIGNED_IN'), 0);
    return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null };
  },
  async resetPasswordForEmail(_email: string) {
    return { data: {}, error: null };
  },
  async updateUser(_patch: Record<string, unknown>) {
    return { data: { user: FAKE_USER }, error: null };
  },
  async signOut() {
    // We pretend to sign out, but the next page load hands the user right
    // back in — that's intentional in this local fork.
    setTimeout(() => fireAuthChange('SIGNED_OUT'), 0);
    return { error: null };
  },
  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.add(callback);
    // Fire INITIAL_SESSION asynchronously so the React state update isn't
    // synchronous with the subscription registration.
    setTimeout(() => {
      try {
        callback('INITIAL_SESSION', FAKE_SESSION);
      } catch {
        // Swallow listener errors.
      }
    }, 0);
    return {
      data: {
        subscription: {
          id: crypto.randomUUID(),
          callback,
          unsubscribe: () => {
            authListeners.delete(callback);
          },
        },
      },
    };
  },
};

export const supabase = {
  auth,
  from(tableName: string) {
    return new QueryBuilder(tableName);
  },
  storage: {
    from: makeStorageBucket,
  },
  channel: makeChannel,
  removeChannel(_channel: ReturnType<typeof makeChannel>) {
    return Promise.resolve('ok');
  },
  removeAllChannels() {
    return Promise.resolve('ok');
  },
  functions: {
    invoke: invokeFunction,
  },
} as unknown as ReturnType<
  // The original module exported a typed createClient<Database>(...) result.
  // We mimic that shape externally so the rest of the app type-checks.
  () => {
    auth: typeof auth;
    from: (t: string) => QueryBuilder;
    storage: { from: typeof makeStorageBucket };
    channel: typeof makeChannel;
    removeChannel: (c: unknown) => Promise<unknown>;
    functions: { invoke: typeof invokeFunction };
  }
>;

// Touch Database type so the unused-import lint stays happy in the rest of
// the project that imports it transitively.
export type _DatabaseShape = Database;
