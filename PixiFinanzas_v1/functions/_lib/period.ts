// MES_ABONO period helpers (ID_MES = AAAAMM, per CAT_MES).
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function toPeriodId(year: number, month1to12: number): number {
  return year * 100 + month1to12;
}

export function periodLabel(id: number): string {
  const year = Math.floor(id / 100);
  const month = id % 100;
  return `${MESES_ES[month - 1]} ${year}`;
}

export function shiftPeriod(id: number, delta: number): number {
  let year = Math.floor(id / 100);
  let month = (id % 100) + delta;
  while (month > 12) { month -= 12; year += 1; }
  while (month < 1) { month += 12; year -= 1; }
  return toPeriodId(year, month);
}

/** The current period (server "today"), for tests this can be injected. */
export function currentPeriod(now = new Date()): number {
  return toPeriodId(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/** IDs of the last N periods strictly before (and not including) `current`. */
export function lastClosedPeriods(current: number, n: number): number[] {
  const out: number[] = [];
  for (let i = n; i >= 1; i--) out.push(shiftPeriod(current, -i));
  return out;
}

/** IDs of the next N periods strictly after `current`. */
export function nextPeriods(current: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) out.push(shiftPeriod(current, i));
  return out;
}

export function formatDateDMY(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
