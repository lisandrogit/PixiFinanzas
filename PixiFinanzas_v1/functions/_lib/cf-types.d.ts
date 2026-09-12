// Minimal ambient types for the small slice of the Cloudflare D1 API this
// project actually uses. Kept local (instead of pulling in the full
// @cloudflare/workers-types package) so it doesn't collide with the "DOM" lib
// the rest of the project (src/, tests/) type-checks against — that package
// redeclares global fetch/Request/Response in ways that conflict with DOM's.
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}
