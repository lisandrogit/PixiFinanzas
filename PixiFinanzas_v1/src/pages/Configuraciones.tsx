import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

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

// Solo para el nav de la izquierda (nombre amigable) — no afecta a MAESTROS,
// que sigue siendo la única fuente de verdad de pk/columnas por tabla.
const MAESTRO_LABELS: Record<string, string> = {
  CAT_CATEGORIA: 'Categorías',
  CAT_TARJETA: 'Tarjetas',
  CAT_CUENTA: 'Cuentas',
  CAT_TIPO_GASTO: 'Tipo de Gasto',
  CAT_CANAL: 'Canales',
  CAT_MES: 'Períodos',
  CAT_COTIZACION_USD: 'Cotización Dólar',
  CAT_INGRESOS: 'Ingresos',
};

const V2_LABEL = 'text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block';
const V2_INPUT = 'w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text focus:outline-none focus:border-v2-accent transition-colors';

export default function Configuraciones() {
  const toast = useToast();
  const [tabla, setTabla] = useState('CAT_CATEGORIA');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const def = MAESTROS[tabla];

  function load() {
    api.get<Record<string, unknown>[]>(`/maestros/${tabla}`).then(setRows);
  }
  // Al cambiar de maestro hay que vaciar rows ANTES de pedir los nuevos: si no,
  // el render intermedio dibuja las filas del maestro anterior con la
  // key={r[def.pk]} del maestro nuevo — como esa columna no existe en esas
  // filas, todas las keys colisionan en "undefined" y React pierde el rastro
  // de esos nodos al reconciliar, dejando filas huérfanas en el DOM.
  useEffect(() => { setRows([]); load(); setDraft({}); setEditingId(null); }, [tabla]);

  function fieldFor(col: string) {
    if (col === 'ACTIVO') return (
      <select className={V2_INPUT} value={draft[col] ?? '1'} onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}>
        <option value="1">Sí</option><option value="0">No</option>
      </select>
    );
    return (
      <input className={`${V2_INPUT} disabled:opacity-50`} value={draft[col] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}
        disabled={col === def.pk && editingId !== null} />
    );
  }

  async function save() {
    try {
      const payload: Record<string, unknown> = {};
      for (const c of def.cols) {
        const raw = draft[c] ?? '';
        payload[c] = /^(ID_|ANO$|MES_NUM$|ORDEN$|ACTIVO$)/.test(c) || c === 'VALOR_VENTA_ARS' || c === 'IMPORTE'
          ? Number(raw) : raw;
      }
      if (editingId !== null) {
        await api.put(`/maestros/${tabla}/${editingId}`, payload);
        toast('Registro actualizado');
      } else {
        await api.post(`/maestros/${tabla}`, payload);
        toast('Registro creado');
      }
      setDraft({}); setEditingId(null); load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Error al guardar');
    }
  }

  function edit(row: Record<string, unknown>) {
    const d: Record<string, string> = {};
    for (const c of def.cols) d[c] = String(row[c] ?? '');
    setDraft(d);
    setEditingId(String(row[def.pk]));
  }

  async function remove(id: unknown) {
    await api.del(`/maestros/${tabla}/${id}`);
    toast('Registro eliminado');
    load();
  }

  return (
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="flex items-center justify-between bg-v2-surface border border-v2-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-v2-text m-0">Configuración</h1>
          <p className="text-sm text-v2-subtle mt-0.5 mb-0">Administración de tablas maestras</p>
        </div>
        <Link to="/usuarios" className="text-sm text-v2-accent hover:text-v2-accent/80 transition-colors">Usuarios, roles y permisos →</Link>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(200px,1fr) 3fr' }}>
        <div className="bg-v2-surface border border-v2-border rounded-xl p-3 h-fit">
          <p className="text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-3 px-2">Maestros</p>
          <nav className="flex flex-col gap-0.5">
            {Object.keys(MAESTROS).map((t) => (
              <button
                key={t}
                onClick={() => setTabla(t)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  tabla === t ? 'bg-v2-accent/10 text-v2-accent border border-v2-accent/30' : 'text-v2-subtle border border-transparent hover:text-v2-text hover:bg-v2-panel'
                }`}
              >
                <div className="text-left">
                  <p className="m-0">{MAESTRO_LABELS[t] || t}</p>
                  <p className={`text-[9px] font-v2mono mt-0.5 m-0 ${tabla === t ? 'text-v2-accent/60' : 'text-v2-subtle/60'}`}>{t}</p>
                </div>
                {tabla === t && <ChevronRight size={12} className="shrink-0" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4 min-w-0 bg-v2-surface border border-v2-border rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-v2-text m-0">{MAESTRO_LABELS[tabla] || tabla}</h3>
              <p className="text-[10px] font-v2mono text-v2-subtle mt-0.5 m-0">{tabla}</p>
            </div>
            <span className="text-xs font-v2mono text-v2-subtle bg-v2-panel px-2.5 py-1 rounded-md border border-v2-border">{rows.length} registros</span>
          </div>

          <div className="flex flex-wrap items-end gap-3 bg-v2-bg border border-v2-border rounded-lg p-4">
            {def.cols.map((c) => (
              <div key={c} style={{ minWidth: 140 }}>
                <label className={V2_LABEL}>{c}</label>
                {fieldFor(c)}
              </div>
            ))}
            <button className="bg-v2-accent hover:bg-v2-accent/90 text-v2-bg font-semibold rounded-lg px-4 py-2 text-sm transition-colors" onClick={save}>
              {editingId !== null ? 'Guardar cambios' : 'Agregar'}
            </button>
            {editingId !== null && (
              <button
                className="border border-v2-border text-v2-text hover:bg-v2-panel rounded-lg px-4 py-2 text-sm transition-colors"
                onClick={() => { setDraft({}); setEditingId(null); }}
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-v2-border">
                  {def.cols.map((c) => <th key={c} className="text-left px-3 py-2 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">{c}</th>)}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r[def.pk])} className="border-b border-v2-border hover:bg-v2-panel transition-colors">
                    {def.cols.map((c) => (
                      <td key={c} className="px-3 py-2 font-v2mono text-v2-text">
                        {c === 'ACTIVO' ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r[c] ? 'bg-v2-success/15 text-v2-success' : 'bg-v2-danger/15 text-v2-danger'}`}>
                            {r[c] ? 'Activo' : 'Inactivo'}
                          </span>
                        ) : String(r[c])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button className="text-v2-subtle hover:text-v2-accent transition-colors text-xs mr-3" onClick={() => edit(r)}>Editar</button>
                      <button className="text-v2-subtle hover:text-v2-danger transition-colors text-xs" onClick={() => remove(r[def.pk])}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
