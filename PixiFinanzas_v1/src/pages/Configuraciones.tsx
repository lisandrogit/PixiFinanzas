import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  useEffect(() => { load(); setDraft({}); setEditingId(null); }, [tabla]);

  function fieldFor(col: string) {
    if (col === 'ACTIVO') return (
      <select className="input" value={draft[col] ?? '1'} onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}>
        <option value="1">Sí</option><option value="0">No</option>
      </select>
    );
    return (
      <input className="input" value={draft[col] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Configuraciones · maestros de datos</h6>
        <Link to="/usuarios" className="text-sm" style={{ color: 'var(--color-accent-700)' }}>Usuarios, roles y permisos →</Link>
      </div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Maestro</label>
        <select className="input" value={tabla} onChange={(e) => setTabla(e.target.value)}>
          {Object.keys(MAESTROS).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {def.cols.map((c) => (
          <div className="field" key={c} style={{ minWidth: 140 }}>
            <label>{c}</label>
            {fieldFor(c)}
          </div>
        ))}
        <button className="btn btn-primary" onClick={save}>{editingId !== null ? 'Guardar cambios' : 'Agregar'}</button>
        {editingId !== null && <button className="btn btn-secondary" onClick={() => { setDraft({}); setEditingId(null); }}>Cancelar</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr>{def.cols.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[def.pk])}>
                {def.cols.map((c) => <td key={c}>{c === 'ACTIVO' ? (r[c] ? 'Sí' : 'No') : String(r[c])}</td>)}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost text-xs" onClick={() => edit(r)}>Editar</button>
                  <button className="btn btn-ghost text-xs" onClick={() => remove(r[def.pk])}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
