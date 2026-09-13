import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../functions/_lib/app';
import { makeEnv, login, extractCookie } from '../testEnv';
import type { Env } from '../../functions/_lib/types';

let env: Env;
beforeEach(() => { env = makeEnv(); });

function req(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('cookie', cookie);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return app.fetch(new Request(`http://test${path}`, { ...init, headers }), env);
}

describe('auth', () => {
  it('rejects unknown routes without a session', async () => {
    const res = await req('/api/home/vencimientos');
    expect(res.status).toBe(401);
  });

  it('logs in with the seeded Rolemaster user and reads /me', async () => {
    const { res, cookie } = await login(app, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ usuario: 'lgiancare', rol: 'Rolemaster' });

    const me = await req('/api/auth/me', {}, cookie);
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.rol).toBe('Rolemaster');
    expect(meBody.secondsLeft).toBeGreaterThan(0);
  });

  it('rejects a wrong password', async () => {
    const { res } = await login(app, env, 'lgiancare', 'wrong-password');
    expect(res.status).toBe(401);
  });

  it('rejects a disabled user', async () => {
    const { cookie } = await login(app, env);
    await req('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Ana', apellido: 'Lopez', dni: '30111222', usuario: 'alopez', clave: 'abc123', rol: 'Consulta' }),
    }, cookie);
    const users = await (await req('/api/usuarios', {}, cookie)).json();
    const created = users.find((u: any) => u.USUARIO === 'alopez');
    await req(`/api/usuarios/${created.ID_USUARIO}/habilitado`, { method: 'PUT', body: JSON.stringify({ habilitado: false }) }, cookie);

    const { res: loginRes } = await login(app, env, 'alopez', 'abc123');
    expect(loginRes.status).toBe(403);
  });

  it('logs out and invalidates the session cookie', async () => {
    const { cookie } = await login(app, env);
    const out = await req('/api/auth/logout', { method: 'POST' }, cookie);
    expect(out.status).toBe(200);
    const clearedCookie = extractCookie(out);
    const me = await req('/api/auth/me', {}, clearedCookie);
    expect(me.status).toBe(401);
  });

  it('enforces Consulta role as read-only outside home/costos', async () => {
    const { cookie } = await login(app, env);
    await req('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'B', apellido: 'C', dni: '1', usuario: 'consulta1', clave: 'abc123', rol: 'Consulta' }),
    }, cookie);
    const { cookie: consultaCookie } = await login(app, env, 'consulta1', 'abc123');

    const home = await req('/api/home/vencimientos', {}, consultaCookie);
    expect(home.status).toBe(200);

    const write = await req('/api/gastos/variable', {
      method: 'POST',
      body: JSON.stringify({ canal: 'Transferencia', categoria: 'Hogar', cuenta: 'Uala', detalle: 'x', importeArs: 100, cotizacion: 1500, mesAbono: 'Octubre 2026' }),
    }, consultaCookie);
    expect(write.status).toBe(403);
  });
});

describe('home', () => {
  it('returns vencimientos for the next 3 periods, with card breakdown and totals', async () => {
    const { cookie } = await login(app, env);
    const body = await (await req('/api/home/vencimientos', {}, cookie)).json();
    expect(body.periods).toHaveLength(3);
    expect(body.periods.map((p: any) => p.label)).toEqual(['Octubre 2026', 'Noviembre 2026', 'Diciembre 2026']);
    expect(body.tarjetas.length).toBeGreaterThan(0);
    expect(body.totalPeriodo).toHaveLength(3);
    // The seed has no gastos loaded yet for future periods (real historical
    // data, not projections) — sinDatos flags that for the frontend's empty state.
    expect(body.sinDatos).toBe(true);
  });

  it('computes the salud financiera variation between closed and next periods', async () => {
    const { cookie } = await login(app, env);
    const body = await (await req('/api/home/salud', {}, cookie)).json();
    expect(typeof body.variacionPct).toBe('number');
    expect(body.avgClosed).toBeGreaterThanOrEqual(0);
    expect(body.sinDatosProximos).toBe(true);
  });

  it('returns 9 months of combined channel and type summaries', async () => {
    const { cookie } = await login(app, env);
    const canal = await (await req('/api/home/resumen-canal', {}, cookie)).json();
    expect(canal).toHaveLength(9);
    const tipo = await (await req('/api/home/resumen-tipo', {}, cookie)).json();
    expect(tipo).toHaveLength(9);
    expect(tipo[0]).toHaveProperty('fijoArs');
    expect(tipo[0]).toHaveProperty('variableArs');
  });
});

describe('costos fijos y variables', () => {
  it('fijos: 9 closed months', async () => {
    const { cookie } = await login(app, env);
    const body = await (await req('/api/costos/fijos', {}, cookie)).json();
    expect(body).toHaveLength(9);
  });
  it('participacion: 12 closed months with a percentage', async () => {
    const { cookie } = await login(app, env);
    const body = await (await req('/api/costos/participacion', {}, cookie)).json();
    expect(body).toHaveLength(12);
    expect(body.every((r: any) => typeof r.porcentaje === 'number')).toBe(true);
  });
  it('variables: top 5 categories only', async () => {
    const { cookie } = await login(app, env);
    const body = await (await req('/api/costos/variables?moneda=ARS', {}, cookie)).json();
    expect(body.categorias.length).toBeLessThanOrEqual(5);
    expect(body.periods).toHaveLength(9);
  });
});

describe('alta de gastos', () => {
  it('registers a simple variable expense by transferencia', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/gastos/variable', {
      method: 'POST',
      body: JSON.stringify({ canal: 'Transferencia', categoria: 'Hogar', cuenta: 'Uala', detalle: 'Compra test', importeArs: 15000, cotizacion: 1500, mesAbono: 'Octubre 2026' }),
    }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registros).toHaveLength(1);
    expect(body.registros[0].usd).toBeCloseTo(10, 5);
  });

  it('replicates one row per cuota with sequential MES_ABONO and a shared ID_COMPRA', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/gastos/variable', {
      method: 'POST',
      body: JSON.stringify({
        canal: 'Tarjeta', categoria: 'Indumentaria', tarjeta: 'Visa Macro', detalle: 'Notebook',
        importeArs: 300000, cotizacion: 1500, mesAbono: 'Octubre 2026',
        cuotas: { cantidad: 3, importePorCuota: 100000, periodoInicio: 'Octubre 2026' },
      }),
    }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registros).toHaveLength(3);
    expect(body.registros.map((r: any) => r.mes)).toEqual(['Octubre 2026', 'Noviembre 2026', 'Diciembre 2026']);

    const rows = await env.DB.prepare(
      "SELECT ID_COMPRA, IMPORTE, ID_MES_ABONO FROM GASTOS_TARJETA WHERE DETALLE LIKE 'Notebook%' ORDER BY ID_MES_ABONO"
    ).all<any>();
    expect(rows.results).toHaveLength(3);
    const ids = new Set(rows.results.map((r: any) => r.ID_COMPRA));
    expect(ids.size).toBe(1);
    expect(rows.results.map((r: any) => r.ID_MES_ABONO)).toEqual([202610, 202611, 202612]);
  });

  it('preloads last closed period fixed costs and confirms a batch', async () => {
    const { cookie } = await login(app, env);
    const preload = await (await req('/api/gastos/fijo/preload', { method: 'GET' }, cookie)).json();
    expect(preload.lastClosedLabel).toBe('Agosto 2026');

    const res = await req('/api/gastos/fijo/lote', {
      method: 'POST',
      body: JSON.stringify({
        mesAbono: 'Septiembre 2026', cotizacion: 1500,
        filas: [
          { concepto: 'Alquiler', categoria: 'Hogar', canal: 'Transferencia', cuenta: 'Uala', importe: 520000 },
          { concepto: 'Internet', categoria: 'Operacion', canal: 'Tarjeta', tarjeta: 'Visa Macro', importe: 48900 },
        ],
      }),
    }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registros).toBe(2);
  });

  it('rejects a tarjeta expense missing the tarjeta field', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/gastos/variable', {
      method: 'POST',
      body: JSON.stringify({ canal: 'Tarjeta', categoria: 'Hogar', detalle: 'x', importeArs: 100, cotizacion: 1500, mesAbono: 'Octubre 2026' }),
    }, cookie);
    expect(res.status).toBe(422);
  });
});

describe('consultas retroactivas', () => {
  it('searches by period range and channel', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/consultas?desde=202409&hasta=202412&canal=tarjeta&tipo=ambos', {}, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows.every((r: any) => r.TABLA === 'GASTOS_TARJETA')).toBe(true);
  });

  it('seeds FECHA_CARGA as a real date string, not an unquoted arithmetic expression', async () => {
    // Regression check: build-seed.mjs once emitted FECHA_CARGA unquoted (e.g. 2024-09-01),
    // which SQLite silently evaluated as 2024 - 9 - 1 = 2014 instead of storing the date.
    const row = await env.DB.prepare(
      "SELECT FECHA_CARGA FROM GASTOS_TARJETA WHERE DETALLE = 'Gastos Colo' AND ID_MES_ABONO = 202409"
    ).first<{ FECHA_CARGA: string }>();
    expect(row?.FECHA_CARGA).toBe('2024-09-01');
  });

  it('blocks the whole import and logs an error entry when a row has an unknown category', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/consultas/importar', {
      method: 'POST',
      body: JSON.stringify({
        motivo: 'Corrección de prueba',
        registros: [{ TABLA: 'GASTOS_TARJETA', ID_GASTO: 1, IMPORTE: 999, MES_ABONO: 202409, CATEGORIA: 'CategoriaInexistente' }],
      }),
    }, cookie);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errores).toHaveLength(1);

    const historial = await (await req('/api/consultas/historial', {}, cookie)).json();
    expect(historial[0].ESTADO).toBe('error');
  });

  it('applies a valid retroactive import and logs a success entry', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/consultas/importar', {
      method: 'POST',
      body: JSON.stringify({
        motivo: 'Corrección de importe',
        registros: [{ TABLA: 'GASTOS_TARJETA', ID_GASTO: 1, IMPORTE: 500000, MES_ABONO: 202409, CATEGORIA: 'Ajenos' }],
      }),
    }, cookie);
    expect(res.status).toBe(200);
    const updated = await env.DB.prepare('SELECT IMPORTE FROM GASTOS_TARJETA WHERE ID_GASTO = 1').first<any>();
    expect(updated.IMPORTE).toBe(500000);

    const historial = await (await req('/api/consultas/historial', {}, cookie)).json();
    expect(historial[0].ESTADO).toBe('exitoso');
  });
});

describe('maestros (configuraciones)', () => {
  it('lists, creates, updates and deletes a catalog row', async () => {
    const { cookie } = await login(app, env);
    const before = await (await req('/api/maestros/CAT_CATEGORIA', {}, cookie)).json();
    expect(before).toHaveLength(11);

    const create = await req('/api/maestros/CAT_CATEGORIA', {
      method: 'POST', body: JSON.stringify({ ID_CATEGORIA: 12, ETIQUETA: 'Mascotas', ACTIVO: 1, ORDEN: 12 }),
    }, cookie);
    expect(create.status).toBe(200);

    const update = await req('/api/maestros/CAT_CATEGORIA/12', {
      method: 'PUT', body: JSON.stringify({ ETIQUETA: 'Mascotas y veterinaria', ACTIVO: 1, ORDEN: 12 }),
    }, cookie);
    expect(update.status).toBe(200);

    const del = await req('/api/maestros/CAT_CATEGORIA/12', { method: 'DELETE' }, cookie);
    expect(del.status).toBe(200);

    const after = await (await req('/api/maestros/CAT_CATEGORIA', {}, cookie)).json();
    expect(after).toHaveLength(11);
  });

  it('returns 404 for an unknown catalog', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/maestros/NOPE', {}, cookie);
    expect(res.status).toBe(404);
  });
});

describe('usuarios', () => {
  it('creates a new user with HABILITADO=SI by default', async () => {
    const { cookie } = await login(app, env);
    await req('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Juan', apellido: 'Perez', dni: '12345678', usuario: 'jperez', clave: 'clave123', rol: 'Consulta' }),
    }, cookie);
    const users = await (await req('/api/usuarios', {}, cookie)).json();
    const created = users.find((u: any) => u.USUARIO === 'jperez');
    expect(created.HABILITADO).toBe(1);
    expect(created.ROL).toBe('Consulta');
  });
});

describe('cotizacion', () => {
  it('saves a manually entered value into CAT_COTIZACION_USD for the current period', async () => {
    const { cookie } = await login(app, env);
    const res = await req('/api/cotizacion', { method: 'POST', body: JSON.stringify({ valor: 1545.5 }) }, cookie);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT VALOR_VENTA_ARS FROM CAT_COTIZACION_USD WHERE ID_MES = 202609').first<any>();
    expect(row.VALOR_VENTA_ARS).toBe(1545.5);
  });
});
