// Minimal D1Database-compatible shim over node:sqlite, used only in tests so
// the real Hono app (functions/_lib/app.ts) can run against a throwaway
// in-memory database without needing wrangler/Miniflare in this sandbox.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>;

class D1PreparedShim {
  private params: unknown[] = [];
  constructor(private db: DatabaseSyncInstance, private sql: string) {}
  bind(...args: unknown[]) { this.params = args; return this; }
  async all<T = unknown>() {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...(this.params as any[])) as T[];
    return { results, success: true, meta: {} };
  }
  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.params as any[]));
    return (row as T) ?? null;
  }
  async run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.params as any[]));
    return { success: true, meta: { last_row_id: info.lastInsertRowid, changes: info.changes } };
  }
}

export class D1Shim {
  constructor(private db: DatabaseSyncInstance) {}
  prepare(sql: string) { return new D1PreparedShim(this.db, sql) as unknown as D1PreparedStatement; }
  exec(sql: string) { this.db.exec(sql); }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function freshDb(): D1Shim {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(join(root, 'migrations', '0001_init.sql'), 'utf-8'));
  raw.exec(readFileSync(join(root, 'migrations', '0002_seed_catalogos_gastos.sql'), 'utf-8'));
  raw.exec(readFileSync(join(root, 'migrations', '0003_seed_usuario_inicial.sql'), 'utf-8'));
  raw.exec(readFileSync(join(root, 'migrations', '0004_login_lockout.sql'), 'utf-8'));
  return new D1Shim(raw);
}
