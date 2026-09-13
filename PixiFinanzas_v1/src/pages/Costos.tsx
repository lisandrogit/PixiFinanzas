import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { LineComboChart, BarLineChart } from '../components/Charts';

interface TipoRow { mes: number; label: string; fijoArs: number; variableArs: number; fijoUsd: number; variableUsd: number }
interface ParticipacionRow { mes: number; label: string; porcentaje: number }
interface VariablesResp { periods: { mes: number; label: string }[]; categorias: { categoria: string; valores: number[] }[] }
interface Categoria { ID_CATEGORIA: number; ETIQUETA: string; ACTIVO: number }

const PALETTE = ['#1565d8', '#0f8f86', '#e0b02c', '#e07a3c', '#9e3526'];

export default function Costos({ refreshKey }: { refreshKey: number }) {
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [tipo, setTipo] = useState<TipoRow[]>([]);
  const [participacion, setParticipacion] = useState<ParticipacionRow[]>([]);
  const [variables, setVariables] = useState<VariablesResp | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [offCats, setOffCats] = useState<Record<number, boolean>>({});

  const activeCats = useMemo(() => categorias.filter((c) => !offCats[c.ID_CATEGORIA]).map((c) => c.ID_CATEGORIA), [categorias, offCats]);
  const catQuery = activeCats.length && activeCats.length < categorias.length ? `&categorias=${activeCats.join(',')}` : '';

  useEffect(() => {
    api.get<TipoRow[]>('/home/resumen-tipo').then(setTipo);
    api.get<ParticipacionRow[]>('/costos/participacion').then(setParticipacion);
    api.get<Categoria[]>('/maestros/CAT_CATEGORIA').then((cs) => setCategorias(cs.filter((c) => c.ACTIVO)));
  }, [refreshKey]);

  useEffect(() => {
    api.get<VariablesResp>(`/costos/variables?moneda=${currency}${catQuery}`).then(setVariables);
  }, [currency, catQuery, refreshKey]);

  function toggleCat(id: number) {
    setOffCats((o) => ({ ...o, [id]: !o[id] }));
  }

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
          <figcaption className="text-[11px] tracking-wide uppercase text-neutral-700 mb-2.5">Detalle de costos fijos y variables · 9 meses cerrados · {currency}</figcaption>
          <LineComboChart
            labels={tipo.map((r) => r.label.slice(0, 3))}
            series={[
              { name: 'Fijos', data: tipo.map((r) => (currency === 'USD' ? r.fijoUsd : r.fijoArs)), color: '#1565d8', area: true },
              { name: 'Variables', data: tipo.map((r) => (currency === 'USD' ? r.variableUsd : r.variableArs)), color: '#0f8f86' },
            ]}
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h6 className="m-0 text-[13px] tracking-wide uppercase">Detalle de costos variables · top 5 categorías · {currency}</h6>
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <button key={c.ID_CATEGORIA} className="chip" aria-pressed={!offCats[c.ID_CATEGORIA]} onClick={() => toggleCat(c.ID_CATEGORIA)}>
                {c.ETIQUETA}
              </button>
            ))}
          </div>
        </div>
        <figure className="m-0 p-4" style={{ border: '2px solid var(--color-divider)' }}>
          {variables && (
            variables.categorias.length ? (
              <LineComboChart
                labels={variables.periods.map((p) => p.label.slice(0, 3))}
                series={variables.categorias.map((c, i) => ({ name: c.categoria, data: c.valores, color: PALETTE[i % PALETTE.length] }))}
              />
            ) : (
              <span className="note">No hay categorías seleccionadas — activá al menos una arriba.</span>
            )
          )}
        </figure>
      </section>
    </div>
  );
}
