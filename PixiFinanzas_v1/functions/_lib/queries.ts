import type { Env } from './types';
import { currentPeriod, lastClosedPeriods, nextPeriods, periodLabel } from './period';

export interface MonthTotal { mes: number; label: string; ars: number; usd: number }

async function sumByMonth(
  env: Env,
  periods: number[],
  categorias: number[] | null,
  tipoGasto: string | null
): Promise<Map<number, { ars: number; usd: number }>> {
  const placeholders = periods.map(() => '?').join(',');
  const catClause = categorias && categorias.length ? `AND ID_CATEGORIA IN (${categorias.map(() => '?').join(',')})` : '';
  const tipoClause = tipoGasto ? `AND TIPO_GASTO = ?` : '';
  const args: unknown[] = [...periods];
  if (categorias && categorias.length) args.push(...categorias);
  if (tipoGasto) args.push(tipoGasto);

  const sql = (vista: string) => `
    SELECT MES_ABONO as mes, SUM(IMPORTE) as ars, SUM(IMPORTE_USD) as usd
    FROM ${vista}
    WHERE MES_ABONO IN (${placeholders}) ${catClause} ${tipoClause}
    GROUP BY MES_ABONO
  `;
  const [tar, tra] = await Promise.all([
    env.DB.prepare(sql('VISTA_GASTOS_TARJETA')).bind(...args).all<{ mes: number; ars: number; usd: number }>(),
    env.DB.prepare(sql('VISTA_GASTOS_TRANSFERENCIA')).bind(...args).all<{ mes: number; ars: number; usd: number }>(),
  ]);
  const out = new Map<number, { ars: number; usd: number }>();
  for (const p of periods) out.set(p, { ars: 0, usd: 0 });
  for (const row of [...tar.results, ...tra.results]) {
    const cur = out.get(row.mes) || { ars: 0, usd: 0 };
    cur.ars += row.ars || 0;
    cur.usd += row.usd || 0;
    out.set(row.mes, cur);
  }
  return out;
}

async function sumByMonthSingleVista(
  env: Env, vista: string, periods: number[], categorias: number[] | null
): Promise<Map<number, { ars: number; usd: number }>> {
  const placeholders = periods.map(() => '?').join(',');
  const catClause = categorias && categorias.length ? `AND ID_CATEGORIA IN (${categorias.map(() => '?').join(',')})` : '';
  const args: unknown[] = [...periods];
  if (categorias && categorias.length) args.push(...categorias);
  const res = await env.DB.prepare(
    `SELECT MES_ABONO as mes, SUM(IMPORTE) as ars, SUM(IMPORTE_USD) as usd FROM ${vista}
     WHERE MES_ABONO IN (${placeholders}) ${catClause} GROUP BY MES_ABONO`
  ).bind(...args).all<{ mes: number; ars: number; usd: number }>();
  const out = new Map<number, { ars: number; usd: number }>();
  for (const p of periods) out.set(p, { ars: 0, usd: 0 });
  for (const row of res.results) out.set(row.mes, { ars: row.ars || 0, usd: row.usd || 0 });
  return out;
}

export async function resumenPorCanal(env: Env, categorias: number[] | null) {
  const cur = currentPeriod();
  const periods = lastClosedPeriods(cur, 9);
  const [tarjeta, transferencia] = await Promise.all([
    sumByMonthSingleVista(env, 'VISTA_GASTOS_TARJETA', periods, categorias),
    sumByMonthSingleVista(env, 'VISTA_GASTOS_TRANSFERENCIA', periods, categorias),
  ]);
  return periods.map((p) => {
    const t = tarjeta.get(p)!, r = transferencia.get(p)!;
    return {
      mes: p, label: periodLabel(p),
      tarjetaArs: t.ars, tarjetaUsd: t.usd,
      transferenciaArs: r.ars, transferenciaUsd: r.usd,
      ars: t.ars + r.ars, usd: t.usd + r.usd,
    };
  });
}

export async function resumenPorTipo(env: Env, categorias: number[] | null) {
  const cur = currentPeriod();
  const periods = lastClosedPeriods(cur, 9);
  const fijos = await sumByMonth(env, periods, categorias, 'COSTO FIJO');
  const variables = await sumByMonth(env, periods, categorias, 'COSTO VARIABLE');
  return periods.map((p) => ({
    mes: p,
    label: periodLabel(p),
    fijoArs: fijos.get(p)!.ars, fijoUsd: fijos.get(p)!.usd,
    variableArs: variables.get(p)!.ars, variableUsd: variables.get(p)!.usd,
  }));
}

export async function costosFijos(env: Env) {
  const cur = currentPeriod();
  const periods = lastClosedPeriods(cur, 9);
  const totals = await sumByMonth(env, periods, null, 'COSTO FIJO');
  return periods.map((p) => ({ mes: p, label: periodLabel(p), ...totals.get(p)! }));
}

export async function participacionFijosSobreIngresos(env: Env) {
  const cur = currentPeriod();
  const periods = lastClosedPeriods(cur, 12);
  const totals = await sumByMonth(env, periods, null, 'COSTO FIJO');
  const placeholders = periods.map(() => '?').join(',');
  const ingresos = await env.DB.prepare(
    `SELECT ID_MES_ABONO as mes, SUM(IMPORTE) as importe FROM CAT_INGRESOS WHERE ID_MES_ABONO IN (${placeholders}) GROUP BY ID_MES_ABONO`
  ).bind(...periods).all<{ mes: number; importe: number }>();
  const ingresoMap = new Map(ingresos.results.map((r) => [r.mes, r.importe]));
  return periods.map((p) => {
    const ingreso = ingresoMap.get(p) || 0;
    const fijo = totals.get(p)!.ars;
    return { mes: p, label: periodLabel(p), porcentaje: ingreso > 0 ? (fijo / ingreso) * 100 : 0 };
  });
}

export async function costosVariablesTop5(env: Env, currency: 'ARS' | 'USD', categorias: number[] | null) {
  const cur = currentPeriod();
  const periods = lastClosedPeriods(cur, 9);
  const placeholders = periods.map(() => '?').join(',');
  const col = currency === 'USD' ? 'IMPORTE_USD' : 'IMPORTE';
  const catClause = categorias && categorias.length ? `AND ID_CATEGORIA IN (${categorias.map(() => '?').join(',')})` : '';
  const args: unknown[] = [...periods];
  if (categorias && categorias.length) args.push(...categorias);
  const sql = (vista: string) => `
    SELECT CATEGORIA as categoria, MES_ABONO as mes, SUM(${col}) as total
    FROM ${vista}
    WHERE MES_ABONO IN (${placeholders}) AND TIPO_GASTO = 'COSTO VARIABLE' ${catClause}
    GROUP BY CATEGORIA, MES_ABONO
  `;
  const [tar, tra] = await Promise.all([
    env.DB.prepare(sql('VISTA_GASTOS_TARJETA')).bind(...args).all<{ categoria: string; mes: number; total: number }>(),
    env.DB.prepare(sql('VISTA_GASTOS_TRANSFERENCIA')).bind(...args).all<{ categoria: string; mes: number; total: number }>(),
  ]);
  const byCat = new Map<string, Map<number, number>>();
  for (const row of [...tar.results, ...tra.results]) {
    if (!byCat.has(row.categoria)) byCat.set(row.categoria, new Map());
    const m = byCat.get(row.categoria)!;
    m.set(row.mes, (m.get(row.mes) || 0) + row.total);
  }
  const totalsByCat = [...byCat.entries()].map(([cat, m]) => ({
    cat,
    sum: [...m.values()].reduce((a, b) => a + b, 0),
    series: periods.map((p) => m.get(p) || 0),
  }));
  totalsByCat.sort((a, b) => b.sum - a.sum);
  const top5 = totalsByCat.slice(0, 5);
  return {
    periods: periods.map((p) => ({ mes: p, label: periodLabel(p) })),
    categorias: top5.map((c) => ({ categoria: c.cat, valores: c.series })),
  };
}

export async function vencimientos(env: Env) {
  const cur = currentPeriod();
  const periods = nextPeriods(cur, 3);
  const placeholders = periods.map(() => '?').join(',');
  const [porTarjeta, porTransferencia] = await Promise.all([
    env.DB.prepare(
      `SELECT TARJETA as tarjeta, MES_ABONO as mes, SUM(IMPORTE) as total FROM VISTA_GASTOS_TARJETA WHERE MES_ABONO IN (${placeholders}) GROUP BY TARJETA, MES_ABONO`
    ).bind(...periods).all<{ tarjeta: string; mes: number; total: number }>(),
    env.DB.prepare(
      `SELECT MES_ABONO as mes, SUM(IMPORTE) as total FROM VISTA_GASTOS_TRANSFERENCIA WHERE MES_ABONO IN (${placeholders}) GROUP BY MES_ABONO`
    ).bind(...periods).all<{ mes: number; total: number }>(),
  ]);
  const tarjetasRes = await env.DB.prepare('SELECT ETIQUETA FROM CAT_TARJETA WHERE ACTIVO = 1 ORDER BY ORDEN').all<{ ETIQUETA: string }>();
  const tarjetas = tarjetasRes.results.map((r) => r.ETIQUETA);
  const byTarjeta = new Map<string, Map<number, number>>();
  for (const t of tarjetas) byTarjeta.set(t, new Map(periods.map((p) => [p, 0])));
  for (const row of porTarjeta.results) {
    if (!byTarjeta.has(row.tarjeta)) byTarjeta.set(row.tarjeta, new Map(periods.map((p) => [p, 0])));
    byTarjeta.get(row.tarjeta)!.set(row.mes, row.total);
  }
  const transferMap = new Map(periods.map((p) => [p, 0]));
  for (const row of porTransferencia.results) transferMap.set(row.mes, row.total);

  const totalPeriodo = periods.map((p) =>
    [...byTarjeta.values()].reduce((s, m) => s + (m.get(p) || 0), 0) + (transferMap.get(p) || 0)
  );
  return {
    periods: periods.map((p) => ({ mes: p, label: periodLabel(p) })),
    tarjetas: [...byTarjeta.entries()].map(([tarjeta, m]) => ({
      tarjeta, valores: periods.map((p) => m.get(p) || 0),
    })),
    totalTarjeta: periods.map((p) => [...byTarjeta.values()].reduce((s, m) => s + (m.get(p) || 0), 0)),
    transferencia: periods.map((p) => transferMap.get(p) || 0),
    totalPeriodo,
    // Todos los períodos futuros en $0 significa que todavía no se cargó ningún
    // gasto para esos meses (fijo por lote, o cuotas ya comprometidas) — no que
    // el cálculo esté mal. El frontend usa esto para mostrar un estado vacío
    // explicativo en vez de una grilla de $0,00 que parece un error.
    sinDatos: totalPeriodo.every((v) => v === 0),
  };
}

export async function saludFinanciera(env: Env) {
  const cur = currentPeriod();
  const closed = lastClosedPeriods(cur, 3);
  const next = nextPeriods(cur, 3);
  // Solo costos variables: los fijos (alquiler, suscripciones, etc.) no
  // reflejan cambios en el hábito de gasto, así que no deberían mover la aguja.
  const totals = await sumByMonth(env, [...closed, ...next], null, 'COSTO VARIABLE');
  const avgClosed = closed.reduce((s, p) => s + totals.get(p)!.ars, 0) / 3;
  const avgNext = next.reduce((s, p) => s + totals.get(p)!.ars, 0) / 3;
  const variacion = avgClosed > 0 ? ((avgNext - avgClosed) / avgClosed) * 100 : 0;
  // avgNext === 0 casi siempre significa "todavía no hay gastos cargados para
  // los próximos períodos", no una caída real del 100% del gasto.
  return { avgClosed, avgNext, variacionPct: variacion, sinDatosProximos: avgNext === 0 };
}
