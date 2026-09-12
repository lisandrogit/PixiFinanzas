import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

interface Mes { ID_MES: number; ETIQUETA: string; ACTIVO: number }
interface Categoria { ID_CATEGORIA: number; ETIQUETA: string; ACTIVO: number }
interface Historial { ID_HISTORIAL: number; FECHA: string; USUARIO: string; MOTIVO: string; REGISTROS: number; ESTADO: string; DETALLE: string }

export default function Consultas() {
  const toast = useToast();
  const [meses, setMeses] = useState<Mes[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [canal, setCanal] = useState('ambos');
  const [tipo, setTipo] = useState('ambos');
  const [catSel, setCatSel] = useState<number[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ fila: number; error: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Mes[]>('/maestros/CAT_MES').then((ms) => {
      const active = ms.filter((m) => m.ACTIVO);
      setMeses(active);
      if (active.length >= 9) { setDesde(String(active[active.length - 9].ID_MES)); setHasta(String(active[active.length - 1].ID_MES)); }
    });
    api.get<Categoria[]>('/maestros/CAT_CATEGORIA').then(setCategorias);
    loadHistorial();
  }, []);

  function loadHistorial() {
    api.get<Historial[]>('/consultas/historial').then(setHistorial);
  }

  async function buscar() {
    if (!desde || !hasta) { toast('Elegí el rango de períodos'); return; }
    const q = new URLSearchParams({ desde, hasta, canal, tipo });
    if (catSel.length) q.set('categorias', catSel.join(','));
    const data = await api.get<{ rows: Record<string, unknown>[] }>(`/consultas?${q}`);
    setRows(data.rows);
  }

  function exportar() {
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta');
    XLSX.writeFile(wb, 'PixiFinanzas_consulta.xlsx');
  }

  function toggleCat(id: number) {
    setCatSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !motivo) { toast('Indicá el motivo de la edición antes de importar'); return; }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const registros = XLSX.utils.sheet_to_json(sheet);
    try {
      const res = await api.post<{ ok: boolean; actualizados?: number }>('/consultas/importar', { motivo, registros });
      toast(`Actualización aplicada: ${res.actualizados} registros`);
      setErrores([]);
      loadHistorial();
      buscar();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.body.errores)) {
        setErrores(err.body.errores as { fila: number; error: string }[]);
      }
      toast('Se encontraron errores — no se aplicó la actualización');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <h6 className="m-0 text-[13px] tracking-wide uppercase">Consultas y actualizaciones retroactivas</h6>

      <div className="flex flex-wrap items-end gap-4">
        <div className="field"><label>Desde</label>
          <select className="input" value={desde} onChange={(e) => setDesde(e.target.value)}>
            {meses.map((m) => <option key={m.ID_MES} value={m.ID_MES}>{m.ETIQUETA}</option>)}
          </select>
        </div>
        <div className="field"><label>Hasta</label>
          <select className="input" value={hasta} onChange={(e) => setHasta(e.target.value)}>
            {meses.map((m) => <option key={m.ID_MES} value={m.ID_MES}>{m.ETIQUETA}</option>)}
          </select>
        </div>
        <div className="field"><label>Canal</label>
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="ambos">Ambos</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div className="field"><label>Tipo de gasto</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="ambos">Ambos</option><option value="fijo">Fijo</option><option value="variable">Variable</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={buscar}>Buscar</button>
        <button className="btn btn-secondary" onClick={exportar} disabled={!rows.length}>Exportar .xlsx</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categorias.map((c) => (
          <button key={c.ID_CATEGORIA} className="chip" aria-pressed={catSel.includes(c.ID_CATEGORIA)} onClick={() => toggleCat(c.ID_CATEGORIA)}>{c.ETIQUETA}</button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Tabla</th><th>Fecha</th><th>Detalle</th><th>Categoría</th><th>Período</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={`${r.TABLA}-${r.ID_GASTO}`}>
                <td style={{ fontSize: 11 }}>{r.TABLA}</td>
                <td>{r.FECHA_CARGA}</td>
                <td>{r.DETALLE}</td>
                <td>{r.CATEGORIA}</td>
                <td>{r.MES_ABONO}</td>
                <td style={{ textAlign: 'right' }}>{Number(r.IMPORTE).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="text-sm text-neutral-600 mt-2">Sin resultados todavía — hacé una búsqueda.</p>}
      </div>

      <hr className="hr" />

      <section className="flex flex-col gap-3.5">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Actualización retroactiva por Excel</h6>
        <div className="flex flex-wrap items-end gap-4">
          <div className="field" style={{ minWidth: 280 }}>
            <label>Motivo de la edición</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. Corrección de categoría" />
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImportFile} />
        </div>
        <span className="note max-w-[520px]">El archivo debe traer TABLA, ID_GASTO, IMPORTE, MES_ABONO y CATEGORIA. Se valida formato y existencia de atributos antes de impactar; si hay al menos un error no se aplica nada.</span>
        {errores.length > 0 && (
          <div className="note" style={{ background: '#ffe0d9', borderColor: '#ffc4b8' }}>
            <strong>Errores encontrados:</strong>
            <ul className="m-0 mt-1 pl-4">
              {errores.map((er, i) => <li key={i}>Fila {er.fila}: {er.error}</li>)}
            </ul>
          </div>
        )}
      </section>

      <hr className="hr" />

      <section className="flex flex-col gap-3.5">
        <h6 className="m-0 text-[13px] tracking-wide uppercase">Historial de actualizaciones masivas</h6>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Motivo</th><th style={{ textAlign: 'right' }}>Registros</th><th>Estado</th></tr></thead>
          <tbody>
            {historial.map((h) => (
              <tr key={h.ID_HISTORIAL}>
                <td>{new Date(h.FECHA).toLocaleString('es-AR')}</td>
                <td>{h.USUARIO}</td>
                <td>{h.MOTIVO}</td>
                <td style={{ textAlign: 'right' }}>{h.REGISTROS}</td>
                <td>
                  <span className="chip" aria-pressed={h.ESTADO === 'exitoso'} style={h.ESTADO === 'error' ? { borderColor: '#ffc4b8', background: '#ffe0d9' } : undefined}>
                    {h.ESTADO}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
