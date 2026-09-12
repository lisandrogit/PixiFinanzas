import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

interface Catalogo { ETIQUETA: string; ACTIVO: number }
interface Mes { ID_MES: number; ETIQUETA: string; ACTIVO: number }

function todayShort() {
  return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AltaGastos() {
  const toast = useToast();
  const [tab, setTab] = useState<'variable' | 'fijo'>('variable');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tarjetas, setTarjetas] = useState<string[]>([]);
  const [cuentas, setCuentas] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);

  const [dolarVenta, setDolarVenta] = useState<number | null>(null);
  const [dolarFecha, setDolarFecha] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Catalogo[]>('/maestros/CAT_CATEGORIA'),
      api.get<Catalogo[]>('/maestros/CAT_TARJETA'),
      api.get<Catalogo[]>('/maestros/CAT_CUENTA'),
      api.get<Mes[]>('/maestros/CAT_MES'),
    ]).then(([cats, tars, cts, ms]) => {
      setCategorias(cats.filter((c) => c.ACTIVO).map((c) => c.ETIQUETA));
      setTarjetas(tars.filter((c) => c.ACTIVO).map((c) => c.ETIQUETA));
      setCuentas(cts.filter((c) => c.ACTIVO).map((c) => c.ETIQUETA));
      setMeses(ms.filter((c) => c.ACTIVO).map((c) => c.ETIQUETA));
    });
    refreshDolar();
  }, []);

  async function refreshDolar() {
    try {
      const d = await api.get<{ venta: number; fecha: string }>('/cotizacion/oficial');
      setDolarVenta(d.venta);
      setDolarFecha(d.fecha);
    } catch {
      toast('No se pudo actualizar la cotización oficial');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="seg">
          <button className="seg-opt" aria-pressed={tab === 'variable'} onClick={() => setTab('variable')}>Gasto variable</button>
          <button className="seg-opt" aria-pressed={tab === 'fijo'} onClick={() => setTab('fijo')}>Gasto fijo (lote)</button>
        </div>
        <span className="text-xs text-neutral-700">ID_GASTO autogenerado · FECHA_CARGA {todayShort()}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4" style={{ border: '2px solid var(--color-accent)', borderRadius: 10, background: '#fff' }}>
        <span className="text-[11px] tracking-wide uppercase font-extrabold" style={{ color: 'var(--color-accent-700)' }}>Dólar oficial · venta</span>
        <span className="font-extrabold text-2xl leading-none">{dolarVenta != null ? `$ ${dolarVenta.toLocaleString('es-AR')}` : '—'}</span>
        <span className="text-xs text-neutral-700">Actualizado {dolarFecha || '—'}</span>
        <button className="btn btn-secondary" onClick={refreshDolar}>Actualizar cotización</button>
        <span className="note max-w-[340px]">El valor se ingresa manualmente en el formulario y se guarda en CAT_COTIZACION_USD.</span>
      </div>

      {tab === 'variable' && (
        <VariableForm categorias={categorias} tarjetas={tarjetas} cuentas={cuentas} meses={meses} cotizacionSugerida={dolarVenta} />
      )}
      {tab === 'fijo' && <FijoBatch categorias={categorias} tarjetas={tarjetas} cuentas={cuentas} meses={meses} cotizacionSugerida={dolarVenta} />}
    </div>
  );
}

function VariableForm({ categorias, tarjetas, cuentas, meses, cotizacionSugerida }: {
  categorias: string[]; tarjetas: string[]; cuentas: string[]; meses: string[]; cotizacionSugerida: number | null;
}) {
  const toast = useToast();
  const [canal, setCanal] = useState<'Tarjeta' | 'Transferencia'>('Tarjeta');
  const [categoria, setCategoria] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [detalle, setDetalle] = useState('');
  const [importe, setImporte] = useState('');
  const [cotiz, setCotiz] = useState('');
  const [mes, setMes] = useState('');
  const [enCuotas, setEnCuotas] = useState(false);
  const [cuotas, setCuotas] = useState('3');
  const [cuotaImporte, setCuotaImporte] = useState('');
  const [cuotaInicio, setCuotaInicio] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ tabla: string; mes: string; importe: number; usd: number }[]>([]);

  useEffect(() => { if (categorias.length && !categoria) setCategoria(categorias[0]); }, [categorias]);
  useEffect(() => { if (tarjetas.length && !tarjeta) setTarjeta(tarjetas[0]); }, [tarjetas]);
  useEffect(() => { if (cuentas.length && !cuenta) setCuenta(cuentas[0]); }, [cuentas]);
  useEffect(() => { if (meses.length && !mes) { setMes(meses[meses.length - 1]); setCuotaInicio(meses[meses.length - 1]); } }, [meses]);
  useEffect(() => { if (cotizacionSugerida && !cotiz) setCotiz(String(cotizacionSugerida)); }, [cotizacionSugerida]);

  const cotizNum = Number(cotiz) || 0;
  useEffect(() => {
    if (canal === 'Tarjeta' && enCuotas) {
      const n = Number(cuotas) || 0;
      const imp = Number(cuotaImporte) || 0;
      const rows = Array.from({ length: n }, (_, i) => ({
        tabla: 'GASTOS_TARJETA', mes: shiftLabel(cuotaInicio, i, meses), importe: imp, usd: cotizNum ? imp / cotizNum : 0,
      }));
      setPreview(rows);
    } else {
      const imp = Number(importe) || 0;
      setPreview([{ tabla: canal === 'Tarjeta' ? 'GASTOS_TARJETA' : 'GASTOS_TRANSFERENCIA', mes, importe: imp, usd: cotizNum ? imp / cotizNum : 0 }]);
    }
  }, [canal, enCuotas, cuotas, cuotaImporte, cuotaInicio, importe, mes, cotizNum, meses]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/gastos/variable', {
        canal, categoria, tarjeta: canal === 'Tarjeta' ? tarjeta : undefined, cuenta: canal === 'Transferencia' ? cuenta : undefined,
        detalle, importeArs: Number(importe) || 0, cotizacion: cotizNum, mesAbono: mes,
        cuotas: canal === 'Tarjeta' && enCuotas ? { cantidad: Number(cuotas), importePorCuota: Number(cuotaImporte), periodoInicio: cuotaInicio } : undefined,
      });
      toast('Gasto guardado');
      setDetalle(''); setImporte(''); setCuotaImporte('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(400px,1fr))' }}>
      <section className="flex flex-col gap-4.5">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Alta de gasto variable</h6>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <div className="field"><label>Canal</label>
            <select className="input" value={canal} onChange={(e) => setCanal(e.target.value as any)}>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <div className="field"><label htmlFor="vCategoria">Categoría</label>
            <select id="vCategoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {canal === 'Tarjeta' ? (
            <div className="field"><label htmlFor="vTarjeta">Tarjeta</label>
              <select id="vTarjeta" className="input" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}>
                {tarjetas.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ) : (
            <div className="field"><label htmlFor="vCuenta">Cuenta</label>
              <select id="vCuenta" className="input" value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
                {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label htmlFor="vDetalle">Detalle</label>
            <input id="vDetalle" className="input" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="ej. Zapatillas running" />
          </div>
          <div className="field"><label htmlFor="vImporte">Importe (ARS)</label>
            <input id="vImporte" className="input" value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div className="field"><label htmlFor="vCotiz">Cotización dólar</label>
            <input id="vCotiz" className="input" value={cotiz} onChange={(e) => setCotiz(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field"><label htmlFor="vMes">MES_ABONO</label>
            <select id="vMes" className="input" value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {canal === 'Tarjeta' && (
          <div className="flex flex-col gap-3.5 p-4" style={{ border: '2px solid var(--color-divider)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] tracking-wide uppercase font-extrabold">Caso especial · compra en cuotas</span>
              <button className="btn btn-ghost text-xs" onClick={() => setEnCuotas((v) => !v)}>{enCuotas ? 'Quitar cuotas' : 'Agregar cuotas'}</button>
            </div>
            {enCuotas && (
              <div className="flex flex-col gap-3.5">
                <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                  <div className="field"><label>Cantidad de cuotas</label>
                    <input className="input" value={cuotas} onChange={(e) => setCuotas(e.target.value)} inputMode="numeric" />
                  </div>
                  <div className="field"><label>Importe por cuota (ARS)</label>
                    <input className="input" value={cuotaImporte} onChange={(e) => setCuotaImporte(e.target.value)} inputMode="decimal" />
                  </div>
                  <div className="field"><label>Período primera cuota</label>
                    <select className="input" value={cuotaInicio} onChange={(e) => setCuotaInicio(e.target.value)}>
                      {meses.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <span className="note">Se replican {cuotas} registros en GASTOS_TARJETA, uno por cuota, con MES_ABONO correlativo desde {cuotaInicio}.</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3.5">
          <button className="btn btn-primary" disabled={saving || !detalle} onClick={save}>Guardar gasto</button>
          <span className="note max-w-[380px]">Se guardan los ID de cada maestro; en pantalla se muestra siempre la descripción.</span>
        </div>
      </section>

      <aside className="flex flex-col gap-3.5 min-w-0">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Registros que se van a impactar</h6>
        <div className="overflow-x-auto">
          <table className="table" style={{ minWidth: 380, tableLayout: 'fixed' }}>
            <thead><tr><th>Tabla</th><th>MES_ABONO</th><th style={{ textAlign: 'right' }}>IMPORTE</th><th style={{ textAlign: 'right' }}>IMPORTE_USD</th></tr></thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11 }}>{r.tabla}</td>
                  <td style={{ fontSize: 12 }}>{r.mes}</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{r.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text)' }}>{r.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

function shiftLabel(startLabel: string, delta: number, meses: string[]): string {
  const idx = meses.indexOf(startLabel);
  if (idx === -1) return startLabel;
  return meses[Math.min(meses.length - 1, idx + delta)] || startLabel;
}

function FijoBatch({ categorias, tarjetas, cuentas, meses, cotizacionSugerida }: {
  categorias: string[]; tarjetas: string[]; cuentas: string[]; meses: string[]; cotizacionSugerida: number | null;
}) {
  const toast = useToast();
  const [loteMes, setLoteMes] = useState('');
  const [lastClosed, setLastClosed] = useState('');
  const [rows, setRows] = useState<{ id: number; concepto: string; categoria: string; canal: 'Tarjeta' | 'Transferencia'; tarjeta: string; cuenta: string; importe: string }[]>([]);
  const [nextId, setNextId] = useState(1);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (meses.length) setLoteMes(meses[meses.length - 1]); }, [meses]);

  useEffect(() => {
    api.get<{ lastClosedLabel: string; filas: any[] }>('/gastos/fijo/preload').then((d) => {
      setLastClosed(d.lastClosedLabel);
      const seeded = d.filas.map((f, i) => ({
        id: i + 1, concepto: f.concepto, categoria: f.categoria, canal: f.canal,
        tarjeta: f.tarjeta || tarjetas[0] || '', cuenta: f.cuenta || cuentas[0] || '', importe: String(f.importe),
      }));
      setRows(seeded);
      setNextId(seeded.length + 1);
    });
  }, [tarjetas.length, cuentas.length]);

  function updateRow(id: number, patch: Partial<(typeof rows)[0]>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { id: nextId, concepto: '', categoria: categorias[0] || '', canal: 'Transferencia', tarjeta: tarjetas[0] || '', cuenta: cuentas[0] || '', importe: '' }]);
    setNextId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const total = rows.reduce((s, r) => s + (Number(r.importe) || 0), 0);

  async function confirmLote() {
    setConfirming(true);
    try {
      await api.post('/gastos/fijo/lote', {
        mesAbono: loteMes, cotizacion: cotizacionSugerida || 1,
        filas: rows.filter((r) => r.concepto && Number(r.importe) > 0).map((r) => ({
          concepto: r.concepto, categoria: r.categoria, canal: r.canal,
          tarjeta: r.canal === 'Tarjeta' ? r.tarjeta : undefined,
          cuenta: r.canal === 'Transferencia' ? r.cuenta : undefined,
          importe: Number(r.importe),
        })),
      });
      toast(`Lote confirmado: ${rows.length} registros para ${loteMes}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Error al confirmar el lote');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-4.5 min-w-0 overflow-x-auto">
      <div className="flex flex-wrap items-end justify-between gap-4.5">
        <div className="field" style={{ minWidth: 220 }}>
          <label>MES_ABONO del lote</label>
          <select className="input" value={loteMes} onChange={(e) => setLoteMes(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <span className="note max-w-[440px]">Precargado con los costos fijos del último período cerrado ({lastClosed || '—'}) y su valor abonado. Editá, agregá o eliminá filas; el resto queda sin cambios.</span>
      </div>

      <table className="table" style={{ minWidth: 820 }}>
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Canal</th><th>Tarjeta / Cuenta</th><th style={{ textAlign: 'right' }}>Importe ARS</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><input className="input" style={{ padding: '6px 8px', fontSize: 13 }} value={row.concepto} onChange={(e) => updateRow(row.id, { concepto: e.target.value })} /></td>
              <td>
                <select className="input" style={{ padding: '6px 8px', fontSize: 13 }} value={row.categoria} onChange={(e) => updateRow(row.id, { categoria: e.target.value })}>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td>
                <select className="input" style={{ padding: '6px 8px', fontSize: 13 }} value={row.canal} onChange={(e) => updateRow(row.id, { canal: e.target.value as any })}>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </td>
              <td>
                {row.canal === 'Tarjeta' ? (
                  <select className="input" style={{ padding: '6px 8px', fontSize: 13 }} value={row.tarjeta} onChange={(e) => updateRow(row.id, { tarjeta: e.target.value })}>
                    {tarjetas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <select className="input" style={{ padding: '6px 8px', fontSize: 13 }} value={row.cuenta} onChange={(e) => updateRow(row.id, { cuenta: e.target.value })}>
                    {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                <input className="input" style={{ padding: '6px 8px', fontSize: 13, textAlign: 'right' }} value={row.importe} onChange={(e) => updateRow(row.id, { importe: e.target.value })} inputMode="decimal" />
              </td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn btn-ghost" style={{ color: 'var(--color-accent-700)', fontSize: 12 }} onClick={() => removeRow(row.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-secondary" onClick={addRow}>Agregar gasto fijo</button>
        <button className="btn btn-primary" disabled={confirming || !rows.length} onClick={confirmLote}>Confirmar lote · {rows.length} registros</button>
        <span className="font-extrabold text-base">Total $ {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        <span className="note">El backend da de alta todos los registros para el período {loteMes || '—'}.</span>
      </div>
    </div>
  );
}
