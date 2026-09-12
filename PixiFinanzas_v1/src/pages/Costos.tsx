import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LineComboChart, BarLineChart } from '../components/Charts';

interface FijoRow { mes: number; label: string; ars: number; usd: number }
interface ParticipacionRow { mes: number; label: string; porcentaje: number }
interface VariablesResp { periods: { mes: number; label: string }[]; categorias: { categoria: string; valores: number[] }[] }

const PALETTE = ['#1565d8', '#0f8f86', '#e0b02c', '#e07a3c', '#9e3526'];

export default function Costos({ refreshKey }: { refreshKey: number }) {
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [fijos, setFijos] = useState<FijoRow[]>([]);
  const [participacion, setParticipacion] = useState<ParticipacionRow[]>([]);
  const [variables, setVariables] = useState<VariablesResp | null>(null);

  useEffect(() => {
    api.get<FijoRow[]>('/costos/fijos').then(setFijos);
    api.get<ParticipacionRow[]>('/costos/participacion').then(setParticipacion);
  }, [refreshKey]);

  useEffect(() => {
    api.get<VariablesResp>(`/costos/variables?moneda=${currency}`).then(setVariables);
  }, [currency, refreshKey]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Costos fijos y variables</h6>
        <div className="seg">
          <button className="seg-opt" aria-pressed={currency === 'ARS'} onClick={() => setCurrency('ARS')}>ARS</button>
          <button className="seg-opt" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>USD</button>
        </div>
      </div>

      <div className="grid gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
        <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
          <figcaption className="text-[11px] tracking-wide uppercase text-neutral-700 mb-2.5">Detalle de costos fijos · 9 meses cerrados · {currency}</figcaption>
          <LineComboChart
            labels={fijos.map((r) => r.label.slice(0, 3))}
            series={[{ name: 'Fijos', data: fijos.map((r) => (currency === 'USD' ? r.usd : r.ars)), color: '#1565d8', area: true }]}
          />
        </figure>
        <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
          <figcaption className="text-[11px] tracking-wide uppercase text-neutral-700 mb-2.5">Participación de costos fijos sobre ingresos · 12 meses</figcaption>
          <BarLineChart
            labels={participacion.map((r) => r.label.slice(0, 3))}
            bars={participacion.map((r) => r.porcentaje)}
            lineFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </figure>
      </div>

      <hr className="hr" />

      <section className="flex flex-col gap-3.5">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Detalle de costos variables · top 5 categorías · {currency}</h6>
        <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
          {variables && (
            <LineComboChart
              labels={variables.periods.map((p) => p.label.slice(0, 3))}
              series={variables.categorias.map((c, i) => ({ name: c.categoria, data: c.valores, color: PALETTE[i % PALETTE.length] }))}
            />
          )}
        </figure>
      </section>
    </div>
  );
}
