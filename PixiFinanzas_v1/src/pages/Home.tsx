import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { LineComboChart, BarComboChart, SaludGauge } from '../components/Charts';

interface Vencimientos {
  periods: { mes: number; label: string }[];
  tarjetas: { tarjeta: string; valores: number[] }[];
  totalTarjeta: number[];
  transferencia: number[];
  totalPeriodo: number[];
}
interface Salud { avgClosed: number; avgNext: number; variacionPct: number }
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

  const activeCats = useMemo(() => categorias.filter((c) => !offCats[c.ID_CATEGORIA]).map((c) => c.ID_CATEGORIA), [categorias, offCats]);
  const catQuery = activeCats.length && activeCats.length < categorias.length ? `?categorias=${activeCats.join(',')}` : '';

  useEffect(() => {
    api.get<Vencimientos>('/home/vencimientos').then(setVenc);
    api.get<Salud>('/home/salud').then(setSalud);
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
    api.get<CanalRow[]>(`/home/resumen-canal${catQuery}`).then(setCanal);
    api.get<TipoRow[]>(`/home/resumen-tipo${catQuery}`).then(setTipo);
  }, [catQuery, refreshKey]);

  function toggleCat(id: number) {
    setOffCats((o) => ({ ...o, [id]: !o[id] }));
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
    <div className="flex flex-col gap-8">
      <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))' }}>
        <section className="min-w-0 overflow-x-auto">
          <h6 className="m-0 mb-3 text-[13px] tracking-wide uppercase">Próximos vencimientos</h6>
          {venc && (
            <table className="table" style={{ minWidth: 400, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>Medio de pago</th>
                  {venc.periods.map((p) => <th key={p.mes} style={{ textAlign: 'right' }}>{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {venc.tarjetas.map((row) => (
                  <tr key={row.tarjeta}>
                    <td style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text)' }}>{row.tarjeta}</td>
                    {row.valores.map((v, i) => {
                      const colVals = venc.tarjetas.map((r) => r.valores[i]);
                      return <td key={i} style={{ textAlign: 'right', fontSize: 13, ...heatColor(v, colVals) }}>{money(v, 'ARS', rate)}</td>;
                    })}
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Total tarjeta</td>
                  {venc.totalTarjeta.map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: 700 }}>{money(v, 'ARS', rate)}</td>)}
                </tr>
                <tr>
                  <td>Transferencia</td>
                  {venc.transferencia.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{money(v, 'ARS', rate)}</td>)}
                </tr>
                <tr style={{ borderTop: '2px solid var(--color-divider)' }}>
                  <td style={{ fontWeight: 800 }}>Total período</td>
                  {venc.totalPeriodo.map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: 800 }}>{money(v, 'ARS', rate)}</td>)}
                </tr>
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-2.5 mt-3">
            <span className="text-[10px] tracking-wide uppercase text-neutral-700">Menor</span>
            <span style={{ flex: 1, maxWidth: 180, height: 8, borderRadius: 999, background: 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 8%, #fff), color-mix(in srgb, var(--color-accent) 54%, #fff), var(--color-accent-700))' }} />
            <span className="text-[10px] tracking-wide uppercase text-neutral-700">Mayor por período</span>
          </div>
        </section>

        <section className="flex flex-col">
          <h6 className="m-0 mb-3 text-[13px] tracking-wide uppercase">Salud financiera</h6>
          <div className="flex-1 flex flex-col items-start justify-between p-4" style={{ border: '2px solid var(--color-divider)' }}>
            {salud && <SaludGauge variacionPct={salud.variacionPct} />}
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <span className="font-extrabold text-[34px] leading-none">{salud ? `${salud.variacionPct >= 0 ? '+' : ''}${salud.variacionPct.toFixed(1)}%` : '—'}</span>
              <span className="text-xs text-neutral-700 max-w-[200px]">vs. promedio de los 3 períodos cerrados</span>
            </div>
            <span className="note mt-2.5">Promedio 3 períodos cerrados vs. próximos 3</span>
          </div>
        </section>
      </div>

      <hr className="hr" />

      <section className="flex flex-col gap-3.5">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Exportación de resumen</h6>
        <div className="flex flex-wrap items-end gap-4">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="expPeriod">Período</label>
            <input className="input" id="expPeriod" list="periodList" value={expPeriod} onChange={(e) => setExpPeriod(e.target.value)} placeholder="Escribí para buscar…" />
            <datalist id="periodList">{meses.map((m) => <option key={m.ID_MES} value={m.ETIQUETA} />)}</datalist>
          </div>
          <div className="field" style={{ minWidth: 180 }}>
            <label htmlFor="expCanal">Canal</label>
            <select className="input" id="expCanal" value={expCanal} onChange={(e) => setExpCanal(e.target.value)}>
              <option value="Ambos">Ambos</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={exportXlsx}>Exportar .xlsx (ARS)</button>
          <span className="note max-w-[340px]">Incluye todos los atributos del modelo según el canal elegido. Exportación siempre en ARS.</span>
        </div>
      </section>

      <hr className="hr" />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h6 className="m-0 text-[13px] tracking-wide uppercase">Resumen de gastos · últimos 9 meses cerrados</h6>
          <div className="flex flex-wrap items-center gap-4">
            <div className="seg">
              <button className="seg-opt" aria-pressed={currency === 'ARS'} onClick={() => setCurrency('ARS')}>ARS</button>
              <button className="seg-opt" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>USD</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button key={c.ID_CATEGORIA} className="chip" aria-pressed={!offCats[c.ID_CATEGORIA]} onClick={() => toggleCat(c.ID_CATEGORIA)}>
                  {c.ETIQUETA}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
          <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
            <figcaption className="text-[11px] tracking-wide uppercase text-neutral-700 mb-2.5">Total por canal · {currency}</figcaption>
            <LineComboChart
              labels={canal.map((r) => r.label.slice(0, 3))}
              series={[
                { name: 'Tarjeta', data: canal.map((r) => currency === 'USD' ? r.tarjetaArs / rate : r.tarjetaArs), color: '#1565d8' },
                { name: 'Transferencia', data: canal.map((r) => currency === 'USD' ? r.transferenciaArs / rate : r.transferenciaArs), color: '#0f8f86' },
                { name: 'Total', data: canal.map((r) => currency === 'USD' ? r.ars / rate : r.ars), color: '#201e1d', dashed: true },
              ]}
            />
          </figure>
          <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
            <figcaption className="text-[11px] tracking-wide uppercase text-neutral-700 mb-2.5">Fijos vs. variables · {currency}</figcaption>
            <BarComboChart
              labels={tipo.map((r) => r.label.slice(0, 3))}
              groups={[
                { name: 'Fijos', data: tipo.map((r) => currency === 'USD' ? r.fijoUsd : r.fijoArs), color: '#1565d8' },
                { name: 'Variables', data: tipo.map((r) => currency === 'USD' ? r.variableUsd : r.variableArs), color: '#0f8f86' },
              ]}
              totalLine={tipo.map((r) => currency === 'USD' ? r.fijoUsd + r.variableUsd : r.fijoArs + r.variableArs)}
            />
          </figure>
        </div>
      </section>
    </div>
  );
}
