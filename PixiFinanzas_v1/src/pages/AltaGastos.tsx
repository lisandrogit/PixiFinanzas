import React, { useEffect, useState } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

interface Catalogo { ETIQUETA: string; ACTIVO: number }
interface Mes { ID_MES: number; ETIQUETA: string; ACTIVO: number }

function todayShort() {
  return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const V2_LABEL = 'text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block';
const V2_INPUT = 'w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text placeholder-[#3a4060] focus:outline-none focus:border-v2-accent transition-colors';

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
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-v2-surface border border-v2-border rounded-xl p-5">
        <div className="flex items-center gap-1 bg-v2-panel rounded-lg p-1">
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'variable' ? 'bg-v2-accent text-v2-bg' : 'text-v2-subtle hover:text-v2-text'}`}
            onClick={() => setTab('variable')}
          >
            Gasto variable
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'fijo' ? 'bg-v2-accent text-v2-bg' : 'text-v2-subtle hover:text-v2-text'}`}
            onClick={() => setTab('fijo')}
          >
            Gasto fijo (lote)
          </button>
        </div>
        <span className="text-xs text-v2-subtle font-v2mono">ID_GASTO autogenerado · FECHA_CARGA {todayShort()}</span>
      </div>

      <div className="flex flex-wrap items-center gap-5 bg-v2-surface border border-v2-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-v2-warning" />
          <span className="text-sm font-semibold text-v2-text">Dólar Oficial · venta</span>
        </div>
        <span className="font-bold text-2xl leading-none font-v2mono text-v2-warning">{dolarVenta != null ? `$ ${dolarVenta.toLocaleString('es-AR')}` : '—'}</span>
        <span className="text-xs text-v2-subtle font-v2mono">Actualizado {dolarFecha || '—'}</span>
        <button
          className="flex items-center gap-2 bg-v2-warning/15 hover:bg-v2-warning/25 border border-v2-warning/40 text-v2-warning rounded-lg px-4 py-2 text-xs font-medium transition-colors"
          onClick={refreshDolar}
        >
          <RefreshCw size={13} />
          Actualizar cotización
        </button>
        <span className="text-xs text-v2-subtle max-w-[340px]">El valor se ingresa manualmente en el formulario y se guarda en CAT_COTIZACION_USD.</span>
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
    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(400px,1fr))' }}>
      <section className="flex flex-col gap-4 bg-v2-surface border border-v2-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-v2-text">Alta de gasto variable</h3>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <div>
            <label className={V2_LABEL}>Canal</label>
            <select className={V2_INPUT} value={canal} onChange={(e) => setCanal(e.target.value as any)}>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label htmlFor="vCategoria" className={V2_LABEL}>Categoría</label>
            <select id="vCategoria" className={V2_INPUT} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {canal === 'Tarjeta' ? (
            <div>
              <label htmlFor="vTarjeta" className={V2_LABEL}>Tarjeta</label>
              <select id="vTarjeta" className={V2_INPUT} value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}>
                {tarjetas.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="vCuenta" className={V2_LABEL}>Cuenta</label>
              <select id="vCuenta" className={V2_INPUT} value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
                {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="vDetalle" className={V2_LABEL}>Detalle</label>
            <input id="vDetalle" className={V2_INPUT} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="ej. Zapatillas running" />
          </div>
          <div>
            <label htmlFor="vImporte" className={V2_LABEL}>Importe (ARS)</label>
            <input id="vImporte" className={`${V2_INPUT} font-v2mono`} value={importe} onChange={(e) => setImporte(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div>
            <label htmlFor="vCotiz" className={V2_LABEL}>Cotización dólar</label>
            <input id="vCotiz" className={`${V2_INPUT} font-v2mono`} value={cotiz} onChange={(e) => setCotiz(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label htmlFor="vMes" className={V2_LABEL}>MES_ABONO</label>
            <select id="vMes" className={V2_INPUT} value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {canal === 'Tarjeta' && (
          <div className="flex flex-col gap-3 bg-v2-bg border border-v2-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] tracking-wide uppercase font-semibold text-v2-text">Caso especial · compra en cuotas</span>
              <button className="text-xs text-v2-accent hover:text-v2-accent/80 transition-colors" onClick={() => setEnCuotas((v) => !v)}>
                {enCuotas ? 'Quitar cuotas' : 'Agregar cuotas'}
              </button>
            </div>
            {enCuotas && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                  <div>
                    <label className={V2_LABEL}>Cantidad de cuotas</label>
                    <input className={V2_INPUT} value={cuotas} onChange={(e) => setCuotas(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <label className={V2_LABEL}>Importe por cuota (ARS)</label>
                    <input className={`${V2_INPUT} font-v2mono`} value={cuotaImporte} onChange={(e) => setCuotaImporte(e.target.value)} inputMode="decimal" />
                  </div>
                  <div>
                    <label className={V2_LABEL}>Período primera cuota</label>
                    <select className={V2_INPUT} value={cuotaInicio} onChange={(e) => setCuotaInicio(e.target.value)}>
                      {meses.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <span className="text-xs text-v2-subtle">Se replican {cuotas} registros en GASTOS_TARJETA, uno por cuota, con MES_ABONO correlativo desde {cuotaInicio}.</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            className="bg-v2-accent hover:bg-v2-accent/90 disabled:opacity-50 text-v2-bg font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
            disabled={saving || !detalle}
            onClick={save}
          >
            Guardar gasto
          </button>
          <span className="text-xs text-v2-subtle max-w-[380px]">Se guardan los ID de cada maestro; en pantalla se muestra siempre la descripción.</span>
        </div>
      </section>

      <aside className="flex flex-col gap-3 min-w-0 bg-v2-surface border border-v2-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-v2-text">Registros que se van a impactar</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 380 }}>
            <thead>
              <tr className="border-b border-v2-border">
                <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Tabla</th>
                <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">MES_ABONO</th>
                <th className="text-right px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">IMPORTE</th>
                <th className="text-right px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">IMPORTE_USD</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-b border-v2-border">
                  <td className="px-2 py-2 text-v2-subtle">{r.tabla}</td>
                  <td className="px-2 py-2 font-v2mono text-v2-text">{r.mes}</td>
                  <td className="px-2 py-2 text-right font-v2mono text-v2-text">{r.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right font-v2mono text-v2-accent">{r.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
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
    <div className="flex flex-col gap-4 min-w-0 overflow-x-auto bg-v2-surface border border-v2-border rounded-xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div style={{ minWidth: 220 }}>
          <label className={V2_LABEL}>MES_ABONO del lote</label>
          <select className={V2_INPUT} value={loteMes} onChange={(e) => setLoteMes(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <span className="text-xs text-v2-subtle max-w-[440px]">Precargado con los costos fijos del último período cerrado ({lastClosed || '—'}) y su valor abonado. Editá, agregá o eliminá filas; el resto queda sin cambios.</span>
      </div>

      <table className="w-full text-xs" style={{ minWidth: 820 }}>
        <thead>
          <tr className="border-b border-v2-border">
            <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Concepto</th>
            <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Categoría</th>
            <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Canal</th>
            <th className="text-left px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Tarjeta / Cuenta</th>
            <th className="text-right px-2 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Importe ARS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-v2-border hover:bg-v2-panel transition-colors">
              <td className="px-2 py-2"><input className={`${V2_INPUT} px-2 py-1.5`} value={row.concepto} onChange={(e) => updateRow(row.id, { concepto: e.target.value })} /></td>
              <td className="px-2 py-2">
                <select className={`${V2_INPUT} px-2 py-1.5`} value={row.categoria} onChange={(e) => updateRow(row.id, { categoria: e.target.value })}>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td className="px-2 py-2">
                <select className={`${V2_INPUT} px-2 py-1.5`} value={row.canal} onChange={(e) => updateRow(row.id, { canal: e.target.value as any })}>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </td>
              <td className="px-2 py-2">
                {row.canal === 'Tarjeta' ? (
                  <select className={`${V2_INPUT} px-2 py-1.5`} value={row.tarjeta} onChange={(e) => updateRow(row.id, { tarjeta: e.target.value })}>
                    {tarjetas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <select className={`${V2_INPUT} px-2 py-1.5`} value={row.cuenta} onChange={(e) => updateRow(row.id, { cuenta: e.target.value })}>
                    {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </td>
              <td className="px-2 py-2 text-right">
                <input className={`${V2_INPUT} px-2 py-1.5 text-right font-v2mono`} value={row.importe} onChange={(e) => updateRow(row.id, { importe: e.target.value })} inputMode="decimal" />
              </td>
              <td className="px-2 py-2 text-right">
                <button className="text-v2-subtle hover:text-v2-danger transition-colors text-xs" onClick={() => removeRow(row.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-4">
        <button className="border border-v2-border text-v2-text hover:bg-v2-panel rounded-lg px-4 py-2 text-sm transition-colors" onClick={addRow}>Agregar gasto fijo</button>
        <button
          className="bg-v2-accent hover:bg-v2-accent/90 disabled:opacity-50 text-v2-bg font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
          disabled={confirming || !rows.length}
          onClick={confirmLote}
        >
          Confirmar lote · {rows.length} registros
        </button>
        <span className="font-bold text-base text-v2-text">Total $ {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        <span className="text-xs text-v2-subtle">El backend da de alta todos los registros para el período {loteMes || '—'}.</span>
      </div>
    </div>
  );
}
