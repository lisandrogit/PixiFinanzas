import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { LineComboChart, BarLineChart, V2_ACCENT, V2_ACCENT2, V2_PALETTE } from '../components/Charts';

interface TipoRow { mes: number; label: string; fijoArs: number; variableArs: number; fijoUsd: number; variableUsd: number }
interface ParticipacionRow { mes: number; label: string; porcentaje: number }
interface VariablesResp { periods: { mes: number; label: string }[]; categorias: { categoria: string; valores: number[] }[] }
interface Categoria { ID_CATEGORIA: number; ETIQUETA: string; ACTIVO: number }

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
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-v2-surface border border-v2-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-v2-text m-0">Costos Fijos y Variables</h1>
          <p className="text-sm text-v2-subtle mt-0.5 mb-0">Análisis de los últimos 9–12 meses</p>
        </div>
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
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
        <figure className="m-0 bg-v2-surface border border-v2-border rounded-xl p-5">
          <figcaption className="text-sm font-semibold text-v2-text mb-4">Detalle de costos fijos y variables · 9 meses cerrados · {currency}</figcaption>
          <LineComboChart
            dark
            labels={tipo.map((r) => r.label.slice(0, 3))}
            series={[
              { name: 'Fijos', data: tipo.map((r) => (currency === 'USD' ? r.fijoUsd : r.fijoArs)), color: V2_ACCENT2, area: true },
              { name: 'Variables', data: tipo.map((r) => (currency === 'USD' ? r.variableUsd : r.variableArs)), color: V2_ACCENT },
            ]}
          />
        </figure>
        <figure className="m-0 bg-v2-surface border border-v2-border rounded-xl p-5">
          <figcaption className="text-sm font-semibold text-v2-text mb-4">Participación de costos fijos sobre ingresos · 12 meses</figcaption>
          <BarLineChart
            dark
            labels={participacion.map((r) => r.label.slice(0, 3))}
            bars={participacion.map((r) => r.porcentaje)}
            lineFormatter={(v) => `${v.toFixed(0)}%`}
          />
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 border-t border-dashed border-v2-danger/40" />
            <span className="text-[10px] font-v2mono text-v2-danger">≥70% crítico</span>
          </div>
        </figure>
      </div>

      <section className="flex flex-col gap-3.5 bg-v2-bg border border-v2-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-v2-text">Detalle de costos variables · top 5 categorías · {currency}</h3>
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
        <figure className="m-0 bg-v2-surface border border-v2-border rounded-xl p-5">
          {variables && (
            variables.categorias.length ? (
              <LineComboChart
                dark
                labels={variables.periods.map((p) => p.label.slice(0, 3))}
                series={variables.categorias.map((c, i) => ({ name: c.categoria, data: c.valores, color: V2_PALETTE[i % V2_PALETTE.length] }))}
              />
            ) : (
              <span className="text-xs text-v2-subtle">No hay categorías seleccionadas — activá al menos una arriba.</span>
            )
          )}
        </figure>
      </section>
    </div>
  );
}
