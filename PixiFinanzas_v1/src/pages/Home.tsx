import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { LineComboChart, BarComboChart, SaludGauge, V2_ACCENT, V2_ACCENT2, V2_INK } from '../components/Charts';

interface Vencimientos {
  periods: { mes: number; label: string }[];
  tarjetas: { tarjeta: string; valores: number[] }[];
  totalTarjeta: number[];
  transferencia: number[];
  totalPeriodo: number[];
  sinDatos: boolean;
}
interface Salud { avgClosed: number; avgNext: number; variacionPct: number; sinDatosProximos: boolean }
interface CanalRow { mes: number; label: string; tarjetaArs: number; transferenciaArs: number; ars: number }
interface TipoRow { mes: number; label: string; fijoArs: number; variableArs: number; fijoUsd: number; variableUsd: number }
interface Categoria { ID_CATEGORIA: number; ETIQUETA: string; ACTIVO: number }
interface Mes { ID_MES: number; ETIQUETA: string; ACTIVO: number }

function money(v: number, currency: 'ARS' | 'USD', rate: number) {
  const val = currency === 'USD' ? v / rate : v;
  const prefix = currency === 'USD' ? 'US$ ' : '$ ';
  return prefix + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export default function Home({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [venc, setVenc] = useState<Vencimientos | null>(null);
  const [salud, setSalud] = useState<Salud | null>(null);
  const [canal, setCanal] = useState<CanalRow[]>([]);
  const [tipo, setTipo] = useState<TipoRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [meses, setMeses] = useState<Mes[]>([]);
  const [rate, setRate] = useState(1480);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [offCats, setOffCats] = useState<Record<number, boolean>>({});
  const [expPeriod, setExpPeriod] = useState('');
  const [expCanal, setExpCanal] = useState('Ambos');

  // Filtro de categorías propio de "Próximos vencimientos" y "Salud
  // financiera" — independiente del de "Resumen de gastos" más abajo.
  // Por default no hay nada destildado, así que entran todas las categorías.
  const [vencCatsOff, setVencCatsOff] = useState<Record<number, boolean>>({});
  const [vencDropdownOpen, setVencDropdownOpen] = useState(false);
  const vencDropdownRef = useRef<HTMLDivElement>(null);

  const activeCats = useMemo(() => categorias.filter((c) => !offCats[c.ID_CATEGORIA]).map((c) => c.ID_CATEGORIA), [categorias, offCats]);
  const catQuery = activeCats.length && activeCats.length < categorias.length ? `?categorias=${activeCats.join(',')}` : '';

  const vencActiveCats = useMemo(() => categorias.filter((c) => !vencCatsOff[c.ID_CATEGORIA]).map((c) => c.ID_CATEGORIA), [categorias, vencCatsOff]);
  const vencCatParam = vencActiveCats.length && vencActiveCats.length < categorias.length ? `?categorias=${vencActiveCats.join(',')}` : '';

  useEffect(() => {
    api.get<Categoria[]>('/maestros/CAT_CATEGORIA').then((cs) => {
      setCategorias(cs.filter((c) => c.ACTIVO));
    });
    api.get<Mes[]>('/maestros/CAT_MES').then((ms) => {
      const active = ms.filter((m) => m.ACTIVO);
      setMeses(active);
      const last = active[active.length - 1];
      if (last) setExpPeriod(last.ETIQUETA);
    });
  }, [refreshKey]);

  useEffect(() => {
    api.get<Vencimientos>(`/home/vencimientos${vencCatParam}`).then(setVenc);
    api.get<Salud>(`/home/salud${vencCatParam}`).then(setSalud);
  }, [vencCatParam, refreshKey]);

  useEffect(() => {
    api.get<CanalRow[]>(`/home/resumen-canal${catQuery}`).then(setCanal);
    api.get<TipoRow[]>(`/home/resumen-tipo${catQuery}`).then(setTipo);
  }, [catQuery, refreshKey]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (vencDropdownRef.current && !vencDropdownRef.current.contains(e.target as Node)) setVencDropdownOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggleCat(id: number) {
    setOffCats((o) => ({ ...o, [id]: !o[id] }));
  }

  function toggleVencCat(id: number) {
    setVencCatsOff((o) => ({ ...o, [id]: !o[id] }));
  }

  async function exportXlsx() {
    if (!expPeriod) return;
    try {
      const data = await api.get<{ rows: Record<string, unknown>[] }>(
        `/export/resumen?periodo=${encodeURIComponent(expPeriod)}&canal=${expCanal.toLowerCase()}`
      );
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
      XLSX.writeFile(wb, `PixiFinanzas_${expPeriod.replace(' ', '_')}.xlsx`);
      toast('Exportación generada');
    } catch {
      toast('No se pudo exportar');
    }
  }

  const heatColor = (v: number, colVals: number[]) => {
    const min = Math.min(...colVals), max = Math.max(...colVals);
    const span = max - min || 1;
    const t = (v - min) / span;
    const isMax = v === max;
    if (isMax) return { background: 'var(--color-accent-700)', color: '#fff', fontWeight: 700 };
    return { background: `color-mix(in srgb, var(--color-accent) ${(8 + t * 46).toFixed(0)}%, #ffffff)`, color: 'var(--color-accent-700)' };
  };

  return (
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <section className="lg:col-span-3 bg-v2-surface border border-v2-border rounded-xl p-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-v2-text m-0">Próximos vencimientos</h3>
            <div className="relative" ref={vencDropdownRef}>
              <button
                className="flex items-center gap-2 bg-v2-bg border border-v2-border rounded-lg px-3 py-1.5 text-xs text-v2-subtle hover:text-v2-text transition-colors"
                onClick={() => setVencDropdownOpen((v) => !v)}
              >
                Categorías {vencActiveCats.length < categorias.length ? `(${vencActiveCats.length}/${categorias.length})` : ''}
                <ChevronDown size={13} className={`transition-transform ${vencDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {vencDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 z-20 w-64 max-h-80 overflow-y-auto bg-v2-panel border border-v2-border rounded-lg shadow-lg p-2">
                  <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-v2-border">
                    <span className="text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Incluir en el cálculo</span>
                    <button className="text-[10px] text-v2-accent hover:text-v2-accent/80" onClick={() => setVencCatsOff({})}>Todas</button>
                  </div>
                  {categorias.map((c) => (
                    <label key={c.ID_CATEGORIA} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-v2-bg cursor-pointer text-xs text-v2-text">
                      <input
                        type="checkbox"
                        className="accent-v2-accent"
                        checked={!vencCatsOff[c.ID_CATEGORIA]}
                        onChange={() => toggleVencCat(c.ID_CATEGORIA)}
                      />
                      {c.ETIQUETA}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          {venc && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {venc.periods.map((p, pi) => {
                const colVals = venc.tarjetas.map((r) => r.valores[pi]);
                return (
                  <div key={p.mes} className="bg-v2-bg rounded-lg p-4 border border-v2-border">
                    <p className="text-xs font-v2mono text-v2-subtle uppercase tracking-wider mb-3">{p.label}</p>
                    {venc.tarjetas.map((row) => (
                      <div key={row.tarjeta} className="flex justify-between items-center mb-2 gap-2">
                        <span className="text-xs text-v2-subtle truncate">{row.tarjeta}</span>
                        <span
                          className="text-xs font-v2mono ml-2 px-1.5 py-0.5 rounded"
                          style={heatColor(row.valores[pi], colVals)}
                        >
                          {money(row.valores[pi], 'ARS', rate)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-v2-border my-3" />
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-v2-subtle">Transferencias</span>
                      <span className="text-xs font-v2mono text-v2-text">{money(venc.transferencia[pi], 'ARS', rate)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs font-semibold text-v2-text">Total</span>
                      <span className="text-sm font-bold font-v2mono text-v2-accent">{money(venc.totalPeriodo[pi], 'ARS', rate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {venc?.sinDatos && (
            <span className="block mt-3 text-xs text-v2-subtle bg-v2-bg border border-v2-border rounded-lg px-3 py-2 max-w-[420px]">
              Todavía no hay gastos cargados para estos períodos. Los vencimientos aparecen acá a
              medida que cargás gastos fijos por lote o gastos en cuotas desde "Alta de Gastos".
            </span>
          )}
        </section>

        <section className="bg-v2-surface border border-v2-border rounded-xl p-4 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-v2-text mb-1 text-center self-stretch">Salud financiera</h3>
          {salud && !salud.sinDatosProximos && <SaludGauge variacionPct={salud.variacionPct} dark height={150} />}
          {salud?.sinDatosProximos ? (
            <>
              <span className="font-bold text-lg text-v2-text leading-tight">Sin datos aún</span>
              <span className="mt-2.5 text-xs text-v2-subtle text-center">
                Todavía no hay gastos cargados para los próximos 3 períodos, así que no se puede
                calcular la variación. Cargá los gastos fijos del próximo mes desde "Alta de Gastos"
                para ver este indicador.
              </span>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-bold text-2xl font-v2mono text-v2-text">{salud ? `${salud.variacionPct >= 0 ? '+' : ''}${salud.variacionPct.toFixed(1)}%` : '—'}</span>
              </div>
              <span className="text-[11px] text-v2-subtle mt-1 text-center">vs. promedio 3 períodos cerrados</span>
            </>
          )}
        </section>
      </div>

      <section className="bg-v2-surface border border-v2-border rounded-xl p-5 flex flex-col gap-3.5">
        <h3 className="text-sm font-semibold text-v2-text">Exportación de resumen</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1" style={{ minWidth: 220 }}>
            <label htmlFor="expPeriod" className="text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block">Período</label>
            <input
              className="w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text focus:outline-none focus:border-v2-accent transition-colors"
              id="expPeriod" list="periodList" value={expPeriod} onChange={(e) => setExpPeriod(e.target.value)} placeholder="Escribí para buscar…"
            />
            <datalist id="periodList">{meses.map((m) => <option key={m.ID_MES} value={m.ETIQUETA} />)}</datalist>
          </div>
          <div className="flex-1" style={{ minWidth: 180 }}>
            <label htmlFor="expCanal" className="text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block">Canal</label>
            <select
              className="w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text focus:outline-none focus:border-v2-accent transition-colors"
              id="expCanal" value={expCanal} onChange={(e) => setExpCanal(e.target.value)}
            >
              <option value="Ambos">Ambos</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <button
            className="flex items-center gap-2 bg-v2-accent hover:bg-v2-accent/90 text-v2-bg font-semibold rounded-lg px-4 py-2 text-sm transition-colors shrink-0"
            onClick={exportXlsx}
          >
            Exportar .xlsx (ARS)
          </button>
          <span className="text-xs text-v2-subtle max-w-[340px]">Incluye todos los atributos del modelo según el canal elegido. Exportación siempre en ARS.</span>
        </div>
      </section>

      <section className="flex flex-col gap-4 bg-v2-bg border border-v2-border rounded-xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h3 className="text-sm font-semibold text-v2-text">Resumen de gastos · últimos 9 meses cerrados</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-v2-panel rounded-lg p-1">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  className={`px-3 py-1 rounded-md text-xs font-v2mono font-medium transition-colors ${
                    currency === c ? 'bg-v2-accent text-v2-bg' : 'text-v2-subtle hover:text-v2-text'
                  }`}
                  onClick={() => setCurrency(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button
                  key={c.ID_CATEGORIA}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    !offCats[c.ID_CATEGORIA]
                      ? 'bg-v2-accent/10 border-v2-accent/30 text-v2-accent'
                      : 'border-v2-border text-v2-subtle hover:text-v2-text'
                  }`}
                  onClick={() => toggleCat(c.ID_CATEGORIA)}
                >
                  {c.ETIQUETA}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
          <figure className="m-0 bg-v2-surface border border-v2-border rounded-xl p-5">
            <figcaption className="text-sm font-semibold text-v2-text mb-4">Total por canal · {currency}</figcaption>
            <LineComboChart
              dark
              labels={canal.map((r) => r.label.slice(0, 3))}
              series={[
                { name: 'Tarjeta', data: canal.map((r) => currency === 'USD' ? r.tarjetaArs / rate : r.tarjetaArs), color: V2_ACCENT },
                { name: 'Transferencia', data: canal.map((r) => currency === 'USD' ? r.transferenciaArs / rate : r.transferenciaArs), color: V2_ACCENT2 },
                { name: 'Total', data: canal.map((r) => currency === 'USD' ? r.ars / rate : r.ars), color: V2_INK, dashed: true },
              ]}
            />
          </figure>
          <figure className="m-0 bg-v2-surface border border-v2-border rounded-xl p-5">
            <figcaption className="text-sm font-semibold text-v2-text mb-4">Fijos vs. variables · {currency}</figcaption>
            <BarComboChart
              dark
              labels={tipo.map((r) => r.label.slice(0, 3))}
              groups={[
                { name: 'Fijos', data: tipo.map((r) => currency === 'USD' ? r.fijoUsd : r.fijoArs), color: V2_ACCENT2 },
                { name: 'Variables', data: tipo.map((r) => currency === 'USD' ? r.variableUsd : r.variableArs), color: V2_ACCENT },
              ]}
              totalLine={tipo.map((r) => currency === 'USD' ? r.fijoUsd + r.variableUsd : r.fijoArs + r.variableArs)}
            />
          </figure>
        </div>
      </section>
    </div>
  );
}
