import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Env } from './types';
import { hashPassword, verifyPassword, signSession, verifySession, type SessionClaims } from './auth';
import { currentPeriod, lastClosedPeriods, nextPeriods, periodLabel, formatDateDMY } from './period';
import * as Q from './queries';

type Vars = { user: SessionClaims | null };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// El detalle del error va solo al log del server (visible en el dashboard de
// Cloudflare / wrangler tail) — nunca al cliente, para no filtrar rutas de
// archivo, forma de las queries u otros detalles internos.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Error interno' }, 500);
});

const COOKIE_NAME = 'px_session';

app.use('*', async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  c.set('user', token ? await verifySession(token, c.env.JWT_SECRET) : null);
  await next();
});

function requireAuth(c: any) {
  const user = c.get('user') as SessionClaims | null;
  if (!user) return null;
  return user;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const REPORT_PREFIXES = ['/api/home', '/api/costos'];

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/auth/login') return next();
  const user = requireAuth(c);
  if (!user) return c.json({ error: 'No autenticado' }, 401);
  const isReport = REPORT_PREFIXES.some((p) => c.req.path.startsWith(p));
  const isAuthSelf = c.req.path.startsWith('/api/auth/');
  if (user.rol === 'Consulta' && !isReport && !isAuthSelf && WRITE_METHODS.has(c.req.method)) {
    return c.json({ error: 'Rol Consulta: solo lectura de home y reportes' }, 403);
  }
  if (user.rol === 'Consulta' && !isReport && !isAuthSelf && c.req.path !== '/api/consultas' && c.req.method === 'GET') {
    // Consulta may also read general query screens per "panel de reportes"; only block writes elsewhere.
  }
  await next();
});

// ── Auth ─────────────────────────────────────────────────────────────────
const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MIN = 15;

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ usuario: z.string().min(1), clave: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Datos inválidos' }, 422);

  const row = await c.env.DB.prepare(
    `SELECT u.ID_USUARIO, u.USUARIO, u.CLAVE_HASH, u.CLAVE_SALT, u.ROL, u.HABILITADO, u.INTENTOS_FALLIDOS, u.BLOQUEADO_HASTA, p.NOMBRE, p.APELLIDO
     FROM USUARIOS u JOIN PERSONAS p ON p.ID_PERSONA = u.ID_PERSONA WHERE u.USUARIO = ?`
  ).bind(parsed.data.usuario).first<any>();

  if (!row) return c.json({ error: 'Usuario o clave incorrectos' }, 401);

  // Bloqueo temporal tras varios intentos fallidos seguidos — sin esto, nada
  // impedía probar contraseñas sin límite contra un usuario conocido.
  if (row.BLOQUEADO_HASTA && new Date(row.BLOQUEADO_HASTA).getTime() > Date.now()) {
    const minutos = Math.ceil((new Date(row.BLOQUEADO_HASTA).getTime() - Date.now()) / 60_000);
    return c.json({ error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} min.` }, 429);
  }
  if (!row.HABILITADO) return c.json({ error: 'Usuario deshabilitado' }, 403);

  const ok = await verifyPassword(parsed.data.clave, row.CLAVE_HASH, row.CLAVE_SALT);
  if (!ok) {
    const intentos = (row.INTENTOS_FALLIDOS || 0) + 1;
    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      const bloqueadoHasta = new Date(Date.now() + BLOQUEO_MIN * 60_000).toISOString();
      await c.env.DB.prepare('UPDATE USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = ? WHERE ID_USUARIO = ?')
        .bind(bloqueadoHasta, row.ID_USUARIO).run();
    } else {
      await c.env.DB.prepare('UPDATE USUARIOS SET INTENTOS_FALLIDOS = ? WHERE ID_USUARIO = ?')
        .bind(intentos, row.ID_USUARIO).run();
    }
    return c.json({ error: 'Usuario o clave incorrectos' }, 401);
  }
  if (row.INTENTOS_FALLIDOS || row.BLOQUEADO_HASTA) {
    await c.env.DB.prepare('UPDATE USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL WHERE ID_USUARIO = ?')
      .bind(row.ID_USUARIO).run();
  }

  const timeoutMin = Number(c.env.SESSION_TIMEOUT_MIN || '60');
  const claims: SessionClaims = {
    sub: String(row.ID_USUARIO), usuario: row.USUARIO, rol: row.ROL,
    nombre: `${row.NOMBRE} ${row.APELLIDO}`,
    exp: Math.floor(Date.now() / 1000) + timeoutMin * 60,
  };
  const token = await signSession(claims, c.env.JWT_SECRET);
  setCookie(c, COOKIE_NAME, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: timeoutMin * 60 });
  return c.json({ usuario: claims.usuario, rol: claims.rol, nombre: claims.nombre });
});

app.post('/api/auth/logout', async (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/auth/me', async (c) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: 'No autenticado' }, 401);
  const secondsLeft = user.exp - Math.floor(Date.now() / 1000);
  return c.json({ usuario: user.usuario, rol: user.rol, nombre: user.nombre, secondsLeft: Math.max(0, secondsLeft) });
});

// ── Home ─────────────────────────────────────────────────────────────────
function parseCategorias(q: string | undefined): number[] | null {
  if (!q) return null;
  const ids = q.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
  return ids.length ? ids : null;
}

app.get('/api/home/vencimientos', async (c) => {
  const categorias = parseCategorias(c.req.query('categorias'));
  return c.json(await Q.vencimientos(c.env, categorias));
});
app.get('/api/home/salud', async (c) => {
  const categorias = parseCategorias(c.req.query('categorias'));
  return c.json(await Q.saludFinanciera(c.env, categorias));
});

app.get('/api/home/resumen-canal', async (c) => {
  const categorias = parseCategorias(c.req.query('categorias'));
  return c.json(await Q.resumenPorCanal(c.env, categorias));
});
app.get('/api/home/resumen-tipo', async (c) => {
  const categorias = parseCategorias(c.req.query('categorias'));
  return c.json(await Q.resumenPorTipo(c.env, categorias));
});

// ── Export ───────────────────────────────────────────────────────────────
app.get('/api/export/resumen', async (c) => {
  const periodoLabel = c.req.query('periodo');
  const canal = (c.req.query('canal') || 'ambos').toLowerCase();
  if (!periodoLabel) return c.json({ error: 'Falta período' }, 422);
  const periodoRow = await c.env.DB.prepare('SELECT ID_MES FROM CAT_MES WHERE ETIQUETA = ?').bind(periodoLabel).first<{ ID_MES: number }>();
  if (!periodoRow) return c.json({ error: 'Período inválido' }, 422);
  const mes = periodoRow.ID_MES;
  const rows: Record<string, unknown>[] = [];
  if (canal === 'tarjeta' || canal === 'ambos') {
    const res = await c.env.DB.prepare('SELECT * FROM VISTA_GASTOS_TARJETA WHERE MES_ABONO = ?').bind(mes).all();
    rows.push(...(res.results as Record<string, unknown>[]));
  }
  if (canal === 'transferencia' || canal === 'ambos') {
    const res = await c.env.DB.prepare('SELECT * FROM VISTA_GASTOS_TRANSFERENCIA WHERE MES_ABONO = ?').bind(mes).all();
    rows.push(...(res.results as Record<string, unknown>[]));
  }
  return c.json({ periodo: periodoLabel, canal, rows });
});

// ── Costos fijos y variables ─────────────────────────────────────────────
app.get('/api/costos/fijos', async (c) => c.json(await Q.costosFijos(c.env)));
app.get('/api/costos/participacion', async (c) => c.json(await Q.participacionFijosSobreIngresos(c.env)));
app.get('/api/costos/variables', async (c) => {
  const currency = (c.req.query('moneda') === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
  const categorias = parseCategorias(c.req.query('categorias'));
  return c.json(await Q.costosVariablesTop5(c.env, currency, categorias));
});

// ── Consultas retroactivas ────────────────────────────────────────────────
app.get('/api/consultas', async (c) => {
  const desde = Number(c.req.query('desde'));
  const hasta = Number(c.req.query('hasta'));
  if (!desde || !hasta) return c.json({ error: 'desde/hasta son obligatorios' }, 422);
  const canal = c.req.query('canal') || 'ambos';
  const tipo = c.req.query('tipo') || 'ambos';
  const categorias = parseCategorias(c.req.query('categorias'));

  function buildQuery(vista: string, tipoCol: 'ID_TARJETA' | 'ID_CUENTA') {
    const clauses = ['MES_ABONO BETWEEN ? AND ?'];
    const args: unknown[] = [desde, hasta];
    if (tipo !== 'ambos') { clauses.push('TIPO_GASTO = ?'); args.push(tipo === 'fijo' ? 'COSTO FIJO' : 'COSTO VARIABLE'); }
    if (categorias) { clauses.push(`ID_CATEGORIA IN (${categorias.map(() => '?').join(',')})`); args.push(...categorias); }
    return { sql: `SELECT * FROM ${vista} WHERE ${clauses.join(' AND ')}`, args };
  }
  const rows: Record<string, unknown>[] = [];
  if (canal === 'tarjeta' || canal === 'ambos') {
    const q = buildQuery('VISTA_GASTOS_TARJETA', 'ID_TARJETA');
    const res = await c.env.DB.prepare(q.sql).bind(...q.args).all();
    rows.push(...(res.results as Record<string, unknown>[]).map((r) => ({ ...r, TABLA: 'GASTOS_TARJETA' })));
  }
  if (canal === 'transferencia' || canal === 'ambos') {
    const q = buildQuery('VISTA_GASTOS_TRANSFERENCIA', 'ID_CUENTA');
    const res = await c.env.DB.prepare(q.sql).bind(...q.args).all();
    rows.push(...(res.results as Record<string, unknown>[]).map((r) => ({ ...r, TABLA: 'GASTOS_TRANSFERENCIA' })));
  }
  return c.json({ rows });
});

const ImportRowSchema = z.object({
  TABLA: z.enum(['GASTOS_TARJETA', 'GASTOS_TRANSFERENCIA']),
  ID_GASTO: z.number().int().positive(),
  IMPORTE: z.number(),
  MES_ABONO: z.number().int(),
  CATEGORIA: z.string().min(1),
});

app.post('/api/consultas/importar', async (c) => {
  const user = requireAuth(c)!;
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ motivo: z.string().min(1), registros: z.array(z.record(z.unknown())).min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Formato inválido', detalle: parsed.error.flatten() }, 422);

  const errores: { fila: number; error: string }[] = [];
  const validRows: z.infer<typeof ImportRowSchema>[] = [];
  for (let i = 0; i < parsed.data.registros.length; i++) {
    const r = ImportRowSchema.safeParse(parsed.data.registros[i]);
    if (!r.success) { errores.push({ fila: i + 1, error: r.error.issues.map((e) => e.message).join('; ') }); continue; }
    const catRow = await c.env.DB.prepare('SELECT 1 FROM CAT_CATEGORIA WHERE ETIQUETA = ?').bind(r.data.CATEGORIA).first();
    if (!catRow) { errores.push({ fila: i + 1, error: `Categoría desconocida: ${r.data.CATEGORIA}` }); continue; }
    validRows.push(r.data);
  }

  const estado = errores.length ? 'error' : 'exitoso';
  await c.env.DB.prepare(
    'INSERT INTO HISTORIAL_ACTUALIZACIONES (FECHA, USUARIO, MOTIVO, REGISTROS, ESTADO, DETALLE) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(new Date().toISOString(), user.usuario, parsed.data.motivo, parsed.data.registros.length, estado, JSON.stringify(errores)).run();

  if (errores.length) return c.json({ ok: false, errores }, 422);

  for (const row of validRows) {
    const cat = await c.env.DB.prepare('SELECT ID_CATEGORIA FROM CAT_CATEGORIA WHERE ETIQUETA = ?').bind(row.CATEGORIA).first<{ ID_CATEGORIA: number }>();
    await c.env.DB.prepare(`UPDATE ${row.TABLA} SET IMPORTE = ?, ID_MES_ABONO = ?, ID_CATEGORIA = ? WHERE ID_GASTO = ?`)
      .bind(row.IMPORTE, row.MES_ABONO, cat?.ID_CATEGORIA, row.ID_GASTO).run();
  }
  return c.json({ ok: true, actualizados: validRows.length });
});

app.get('/api/consultas/historial', async (c) => {
  const res = await c.env.DB.prepare('SELECT * FROM HISTORIAL_ACTUALIZACIONES ORDER BY ID_HISTORIAL DESC LIMIT 100').all();
  return c.json(res.results);
});

// ── Maestros (configuraciones) ────────────────────────────────────────────
const MAESTROS: Record<string, { pk: string; cols: string[] }> = {
  CAT_CATEGORIA: { pk: 'ID_CATEGORIA', cols: ['ID_CATEGORIA', 'ETIQUETA', 'ACTIVO', 'ORDEN'] },
  CAT_TARJETA: { pk: 'ID_TARJETA', cols: ['ID_TARJETA', 'ETIQUETA', 'ACTIVO', 'ORDEN'] },
  CAT_CUENTA: { pk: 'ID_CUENTA', cols: ['ID_CUENTA', 'ETIQUETA', 'ACTIVO', 'ORDEN'] },
  CAT_TIPO_GASTO: { pk: 'ID_TIPO_GASTO', cols: ['ID_TIPO_GASTO', 'ETIQUETA', 'ACTIVO', 'ORDEN'] },
  CAT_CANAL: { pk: 'ID_CANAL', cols: ['ID_CANAL', 'ETIQUETA', 'ACTIVO', 'ORDEN'] },
  CAT_MES: { pk: 'ID_MES', cols: ['ID_MES', 'ETIQUETA', 'ANO', 'MES_NUM', 'ACTIVO'] },
  CAT_COTIZACION_USD: { pk: 'ID_MES', cols: ['ID_MES', 'FECHA_COTIZACION_1ER_DIA_HABIL', 'VALOR_VENTA_ARS'] },
  CAT_INGRESOS: { pk: 'ID_INGRESO', cols: ['ID_INGRESO', 'ID_MES_ABONO', 'IMPORTE'] },
};

app.get('/api/maestros/:tabla', async (c) => {
  const tabla = c.req.param('tabla');
  const def = MAESTROS[tabla];
  if (!def) return c.json({ error: 'Maestro desconocido' }, 404);
  const res = await c.env.DB.prepare(`SELECT * FROM ${tabla} ORDER BY ${def.pk}`).all();
  return c.json(res.results);
});

app.post('/api/maestros/:tabla', async (c) => {
  const user = requireAuth(c)!;
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const tabla = c.req.param('tabla');
  const def = MAESTROS[tabla];
  if (!def) return c.json({ error: 'Maestro desconocido' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const cols = def.cols.filter((col) => col !== def.pk || body[col] !== undefined);
  const values = cols.map((col) => body[col]);
  await c.env.DB.prepare(`INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...values).run();
  return c.json({ ok: true });
});

app.put('/api/maestros/:tabla/:id', async (c) => {
  const user = requireAuth(c)!;
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const tabla = c.req.param('tabla');
  const def = MAESTROS[tabla];
  if (!def) return c.json({ error: 'Maestro desconocido' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const cols = def.cols.filter((col) => col !== def.pk);
  const setClause = cols.map((col) => `${col} = ?`).join(', ');
  await c.env.DB.prepare(`UPDATE ${tabla} SET ${setClause} WHERE ${def.pk} = ?`)
    .bind(...cols.map((col) => body[col]), c.req.param('id')).run();
  return c.json({ ok: true });
});

app.delete('/api/maestros/:tabla/:id', async (c) => {
  const user = requireAuth(c)!;
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const tabla = c.req.param('tabla');
  const def = MAESTROS[tabla];
  if (!def) return c.json({ error: 'Maestro desconocido' }, 404);
  await c.env.DB.prepare(`DELETE FROM ${tabla} WHERE ${def.pk} = ?`).bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── Alta de gastos ─────────────────────────────────────────────────────────
async function lookupId(env: Env, tabla: string, pk: string, etiqueta: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT ${pk} as id FROM ${tabla} WHERE ETIQUETA = ?`).bind(etiqueta).first<{ id: number }>();
  if (!row) throw new Error(`Valor desconocido en ${tabla}: ${etiqueta}`);
  return row.id;
}
async function periodIdFromLabel(env: Env, label: string): Promise<number> {
  const row = await env.DB.prepare('SELECT ID_MES as id FROM CAT_MES WHERE ETIQUETA = ?').bind(label).first<{ id: number }>();
  if (!row) throw new Error(`Período desconocido: ${label}`);
  return row.id;
}

const GastoVariableSchema = z.object({
  canal: z.enum(['Tarjeta', 'Transferencia']),
  categoria: z.string().min(1),
  tarjeta: z.string().optional(),
  cuenta: z.string().optional(),
  detalle: z.string().min(1),
  importeArs: z.number().positive(),
  cotizacion: z.number().positive(),
  mesAbono: z.string().min(1),
  cuotas: z.object({
    cantidad: z.number().int().min(2).max(60),
    importePorCuota: z.number().positive(),
    periodoInicio: z.string().min(1),
  }).optional(),
});

app.post('/api/gastos/variable', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = GastoVariableSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, 422);
  const d = parsed.data;
  const idCategoria = await lookupId(c.env, 'CAT_CATEGORIA', 'ID_CATEGORIA', d.categoria);
  const idTipoGasto = await lookupId(c.env, 'CAT_TIPO_GASTO', 'ID_TIPO_GASTO', 'COSTO VARIABLE');
  const idCanal = await lookupId(c.env, 'CAT_CANAL', 'ID_CANAL', d.canal);
  const hoy = new Date().toISOString().slice(0, 10);
  const inserted: { tabla: string; mes: string; importe: number; usd: number }[] = [];

  if (d.canal === 'Tarjeta' && d.cuotas) {
    if (!d.tarjeta) return c.json({ error: 'Falta tarjeta' }, 422);
    const idTarjeta = await lookupId(c.env, 'CAT_TARJETA', 'ID_TARJETA', d.tarjeta);
    const idCompra = crypto.randomUUID();
    const startId = await periodIdFromLabel(c.env, d.cuotas.periodoInicio);
    let year = Math.floor(startId / 100), month = startId % 100;
    for (let i = 0; i < d.cuotas.cantidad; i++) {
      const mesId = year * 100 + month;
      const mesLabel = periodLabel(mesId);
      const importeUsd = d.cuotas.importePorCuota / d.cotizacion;
      await c.env.DB.prepare(
        `INSERT INTO GASTOS_TARJETA (FECHA_CARGA, DETALLE, ID_CATEGORIA, ID_TARJETA, ID_TIPO_GASTO, ID_CANAL, ID_MES_ABONO, IMPORTE, MONEDA, IMPORTE_USD, ID_COMPRA)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARS', ?, ?)`
      ).bind(hoy, `${d.detalle} (cuota ${i + 1}/${d.cuotas.cantidad})`, idCategoria, idTarjeta, idTipoGasto, idCanal, mesId, d.cuotas.importePorCuota, importeUsd, idCompra).run();
      inserted.push({ tabla: 'GASTOS_TARJETA', mes: mesLabel, importe: d.cuotas.importePorCuota, usd: importeUsd });
      month += 1; if (month > 12) { month = 1; year += 1; }
    }
  } else if (d.canal === 'Tarjeta') {
    if (!d.tarjeta) return c.json({ error: 'Falta tarjeta' }, 422);
    const idTarjeta = await lookupId(c.env, 'CAT_TARJETA', 'ID_TARJETA', d.tarjeta);
    const mesId = await periodIdFromLabel(c.env, d.mesAbono);
    const importeUsd = d.importeArs / d.cotizacion;
    await c.env.DB.prepare(
      `INSERT INTO GASTOS_TARJETA (FECHA_CARGA, DETALLE, ID_CATEGORIA, ID_TARJETA, ID_TIPO_GASTO, ID_CANAL, ID_MES_ABONO, IMPORTE, MONEDA, IMPORTE_USD)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARS', ?)`
    ).bind(hoy, d.detalle, idCategoria, idTarjeta, idTipoGasto, idCanal, mesId, d.importeArs, importeUsd).run();
    inserted.push({ tabla: 'GASTOS_TARJETA', mes: d.mesAbono, importe: d.importeArs, usd: importeUsd });
  } else {
    if (!d.cuenta) return c.json({ error: 'Falta cuenta' }, 422);
    const idCuenta = await lookupId(c.env, 'CAT_CUENTA', 'ID_CUENTA', d.cuenta);
    const mesId = await periodIdFromLabel(c.env, d.mesAbono);
    const importeUsd = d.importeArs / d.cotizacion;
    await c.env.DB.prepare(
      `INSERT INTO GASTOS_TRANSFERENCIA (FECHA_CARGA, DETALLE, ID_CATEGORIA, ID_CUENTA, ID_TIPO_GASTO, ID_CANAL, ID_MES_ABONO, IMPORTE, MONEDA, IMPORTE_USD)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARS', ?)`
    ).bind(hoy, d.detalle, idCategoria, idCuenta, idTipoGasto, idCanal, mesId, d.importeArs, importeUsd).run();
    inserted.push({ tabla: 'GASTOS_TRANSFERENCIA', mes: d.mesAbono, importe: d.importeArs, usd: importeUsd });
  }

  await upsertCotizacion(c.env, d.cotizacion);
  return c.json({ ok: true, registros: inserted });
});

app.get('/api/gastos/fijo/preload', async (c) => {
  const cur = currentPeriod();
  const lastClosed = lastClosedPeriods(cur, 1)[0];
  const [tar, tra] = await Promise.all([
    c.env.DB.prepare(`SELECT DETALLE as concepto, CATEGORIA as categoria, 'Tarjeta' as canal, TARJETA as tarjeta, IMPORTE as importe
      FROM VISTA_GASTOS_TARJETA WHERE MES_ABONO = ? AND TIPO_GASTO = 'COSTO FIJO'`).bind(lastClosed).all(),
    c.env.DB.prepare(`SELECT DETALLE as concepto, CATEGORIA as categoria, 'Transferencia' as canal, CUENTA as cuenta, IMPORTE as importe
      FROM VISTA_GASTOS_TRANSFERENCIA WHERE MES_ABONO = ? AND TIPO_GASTO = 'COSTO FIJO'`).bind(lastClosed).all(),
  ]);
  return c.json({ lastClosedLabel: periodLabel(lastClosed), filas: [...tar.results, ...tra.results] });
});

const FilaLoteSchema = z.object({
  concepto: z.string().min(1),
  categoria: z.string().min(1),
  canal: z.enum(['Tarjeta', 'Transferencia']),
  tarjeta: z.string().optional(),
  cuenta: z.string().optional(),
  importe: z.number().positive(),
});
app.post('/api/gastos/fijo/lote', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ mesAbono: z.string().min(1), filas: z.array(FilaLoteSchema).min(1), cotizacion: z.number().positive() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, 422);
  const { mesAbono, filas, cotizacion } = parsed.data;
  const mesId = await periodIdFromLabel(c.env, mesAbono);
  const idTipoGasto = await lookupId(c.env, 'CAT_TIPO_GASTO', 'ID_TIPO_GASTO', 'COSTO FIJO');
  const hoy = new Date().toISOString().slice(0, 10);
  let count = 0;
  for (const fila of filas) {
    const idCategoria = await lookupId(c.env, 'CAT_CATEGORIA', 'ID_CATEGORIA', fila.categoria);
    const idCanal = await lookupId(c.env, 'CAT_CANAL', 'ID_CANAL', fila.canal);
    const importeUsd = fila.importe / cotizacion;
    if (fila.canal === 'Tarjeta') {
      if (!fila.tarjeta) return c.json({ error: `Falta tarjeta en fila: ${fila.concepto}` }, 422);
      const idTarjeta = await lookupId(c.env, 'CAT_TARJETA', 'ID_TARJETA', fila.tarjeta);
      await c.env.DB.prepare(
        `INSERT INTO GASTOS_TARJETA (FECHA_CARGA, DETALLE, ID_CATEGORIA, ID_TARJETA, ID_TIPO_GASTO, ID_CANAL, ID_MES_ABONO, IMPORTE, MONEDA, IMPORTE_USD)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARS', ?)`
      ).bind(hoy, fila.concepto, idCategoria, idTarjeta, idTipoGasto, idCanal, mesId, fila.importe, importeUsd).run();
    } else {
      if (!fila.cuenta) return c.json({ error: `Falta cuenta en fila: ${fila.concepto}` }, 422);
      const idCuenta = await lookupId(c.env, 'CAT_CUENTA', 'ID_CUENTA', fila.cuenta);
      await c.env.DB.prepare(
        `INSERT INTO GASTOS_TRANSFERENCIA (FECHA_CARGA, DETALLE, ID_CATEGORIA, ID_CUENTA, ID_TIPO_GASTO, ID_CANAL, ID_MES_ABONO, IMPORTE, MONEDA, IMPORTE_USD)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ARS', ?)`
      ).bind(hoy, fila.concepto, idCategoria, idCuenta, idTipoGasto, idCanal, mesId, fila.importe, importeUsd).run();
    }
    count++;
  }
  await upsertCotizacion(c.env, cotizacion);
  return c.json({ ok: true, registros: count });
});

// ── Cotización de dólar ───────────────────────────────────────────────────
async function upsertCotizacion(env: Env, valorVenta: number) {
  const cur = currentPeriod();
  const hoy = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO CAT_COTIZACION_USD (ID_MES, FECHA_COTIZACION_1ER_DIA_HABIL, VALOR_VENTA_ARS) VALUES (?, ?, ?)
     ON CONFLICT(ID_MES) DO UPDATE SET VALOR_VENTA_ARS = excluded.VALOR_VENTA_ARS, FECHA_COTIZACION_1ER_DIA_HABIL = excluded.FECHA_COTIZACION_1ER_DIA_HABIL`
  ).bind(cur, hoy, valorVenta).run();
}

app.get('/api/cotizacion/oficial', async (c) => {
  try {
    // Sin esto, el runtime de Workers puede cachear la subrequest en el edge
    // de Cloudflare según los headers de cache de dolarapi.com — si esos
    // headers piden un TTL largo, el valor queda "pegado" por días aunque la
    // cotización real ya haya cambiado. cacheTtl:0 fuerza a ir siempre a origen.
    const res = await fetch(c.env.DOLAR_API_URL, {
      cf: { cacheTtl: 0, cacheEverything: false },
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { venta: number; fechaActualizacion: string };
    return c.json({ venta: data.venta, fecha: formatDateDMY(data.fechaActualizacion) });
  } catch (e) {
    return c.json({ error: 'No se pudo consultar la cotización oficial' }, 502);
  }
});

app.post('/api/cotizacion', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ valor: z.number().positive() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Valor inválido' }, 422);
  await upsertCotizacion(c.env, parsed.data.valor);
  return c.json({ ok: true });
});

// ── Usuarios ───────────────────────────────────────────────────────────────
app.get('/api/usuarios', async (c) => {
  const user = requireAuth(c)!;
  // Expone DNI de todos los usuarios — dato sensible, no apto para el rol Consulta.
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const res = await c.env.DB.prepare(
    `SELECT u.ID_USUARIO, u.USUARIO, u.ROL, u.HABILITADO, p.NOMBRE, p.APELLIDO, p.DNI
     FROM USUARIOS u JOIN PERSONAS p ON p.ID_PERSONA = u.ID_PERSONA ORDER BY u.ID_USUARIO`
  ).all();
  return c.json(res.results);
});

const NuevoUsuarioSchema = z.object({
  nombre: z.string().min(1), apellido: z.string().min(1), dni: z.string().min(1),
  usuario: z.string().min(3), clave: z.string().min(6), rol: z.enum(['Rolemaster', 'Consulta']),
});
app.post('/api/usuarios', async (c) => {
  const user = requireAuth(c)!;
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const body = await c.req.json().catch(() => null);
  const parsed = NuevoUsuarioSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Datos inválidos', detalle: parsed.error.flatten() }, 422);
  const d = parsed.data;
  const persona = await c.env.DB.prepare('INSERT INTO PERSONAS (NOMBRE, APELLIDO, DNI) VALUES (?, ?, ?) RETURNING ID_PERSONA')
    .bind(d.nombre, d.apellido, d.dni).first<{ ID_PERSONA: number }>();
  const { hash, salt } = await hashPassword(d.clave);
  await c.env.DB.prepare('INSERT INTO USUARIOS (ID_PERSONA, USUARIO, CLAVE_HASH, CLAVE_SALT, ROL, HABILITADO) VALUES (?, ?, ?, ?, ?, 1)')
    .bind(persona!.ID_PERSONA, d.usuario, hash, salt, d.rol).run();
  return c.json({ ok: true });
});

app.put('/api/usuarios/:id/habilitado', async (c) => {
  const user = requireAuth(c)!;
  if (user.rol !== 'Rolemaster') return c.json({ error: 'Requiere rol Rolemaster' }, 403);
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE USUARIOS SET HABILITADO = ? WHERE ID_USUARIO = ?').bind(body.habilitado ? 1 : 0, c.req.param('id')).run();
  return c.json({ ok: true });
});

export default app;
