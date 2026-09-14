import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Filter, Search, Download, CheckCircle, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

interface Mes { ID_MES: number; ETIQUETA: string; ACTIVO: number }
interface Categoria { ID_CATEGORIA: number; ETIQUETA: string; ACTIVO: number }
interface Historial { ID_HISTORIAL: number; FECHA: string; USUARIO: string; MOTIVO: string; REGISTROS: number; ESTADO: string; DETALLE: string }

const V2_LABEL = 'text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block';
const V2_INPUT = 'w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text focus:outline-none focus:border-v2-accent transition-colors';

export default function Consultas() {
  const toast = useToast();
  const [tab, setTab] = useState<'consulta' | 'historial'>('consulta');
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
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-v2-surface border border-v2-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-v2-text m-0">Consultas y Actualizaciones</h1>
          <p className="text-sm text-v2-subtle mt-0.5 mb-0">Búsqueda de gastos y actualizaciones retroactivas</p>
        </div>
        <div className="flex items-center gap-1 bg-v2-panel rounded-lg p-1">
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'consulta' ? 'bg-v2-accent text-v2-bg' : 'text-v2-subtle hover:text-v2-text'}`}
            onClick={() => setTab('consulta')}
          >
            Consulta general
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'historial' ? 'bg-v2-accent text-v2-bg' : 'text-v2-subtle hover:text-v2-text'}`}
            onClick={() => setTab('historial')}
          >
            Historial masivo
          </button>
        </div>
      </div>

      {tab === 'consulta' ? (
        <>
          <div className="bg-v2-surface border border-v2-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-v2-text mb-4 flex items-center gap-2">
              <Filter size={14} className="text-v2-accent" />
              Filtros de búsqueda
            </h3>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
              <div>
                <label className={V2_LABEL}>Desde</label>
                <select className={V2_INPUT} value={desde} onChange={(e) => setDesde(e.target.value)}>
                  {meses.map((m) => <option key={m.ID_MES} value={m.ID_MES}>{m.ETIQUETA}</option>)}
                </select>
              </div>
              <div>
                <label className={V2_LABEL}>Hasta</label>
                <select className={V2_INPUT} value={hasta} onChange={(e) => setHasta(e.target.value)}>
                  {meses.map((m) => <option key={m.ID_MES} value={m.ID_MES}>{m.ETIQUETA}</option>)}
                </select>
              </div>
              <div>
                <label className={V2_LABEL}>Canal</label>
                <select className={V2_INPUT} value={canal} onChange={(e) => setCanal(e.target.value)}>
                  <option value="ambos">Ambos</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div>
                <label className={V2_LABEL}>Tipo de gasto</label>
                <select className={V2_INPUT} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="ambos">Ambos</option><option value="fijo">Fijo</option><option value="variable">Variable</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
              <div className="flex gap-1.5 flex-wrap">
                {categorias.map((c) => (
                  <button
                    key={c.ID_CATEGORIA}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors border ${
                      catSel.includes(c.ID_CATEGORIA)
                        ? 'bg-v2-accent/10 text-v2-accent border-v2-accent/30'
                        : 'bg-v2-bg text-v2-subtle border-v2-border hover:text-v2-text'
                    }`}
                    onClick={() => toggleCat(c.ID_CATEGORIA)}
                  >
                    {c.ETIQUETA}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="flex items-center gap-1.5 text-xs text-v2-subtle hover:text-v2-text bg-v2-panel border border-v2-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  onClick={exportar}
                  disabled={!rows.length}
                >
                  <Download size={12} />
                  Exportar .xlsx
                </button>
                <button
                  className="flex items-center gap-2 bg-v2-accent hover:bg-v2-accent/90 text-v2-bg font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
                  onClick={buscar}
                >
                  <Search size={14} />
                  Buscar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-v2-surface border border-v2-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-v2-border">
              <span className="text-sm font-semibold text-v2-text">Resultados</span>
              <span className="text-xs font-v2mono bg-v2-accent/10 text-v2-accent px-2 py-0.5 rounded-md">{rows.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th className="text-left px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Tabla</th>
                    <th className="text-left px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Fecha</th>
                    <th className="text-left px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Detalle</th>
                    <th className="text-left px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Categoría</th>
                    <th className="text-left px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Período</th>
                    <th className="text-right px-4 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider whitespace-nowrap">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={`${r.TABLA}-${r.ID_GASTO}`} className="border-b border-v2-border hover:bg-v2-panel transition-colors">
                      <td className="px-4 py-3 font-v2mono text-v2-subtle">{r.TABLA}</td>
                      <td className="px-4 py-3 font-v2mono text-v2-text">{r.FECHA_CARGA}</td>
                      <td className="px-4 py-3 text-v2-text">{r.DETALLE}</td>
                      <td className="px-4 py-3">
                        <span className="bg-v2-accent2/15 text-v2-accent2 px-2 py-0.5 rounded text-[10px]">{r.CATEGORIA}</span>
                      </td>
                      <td className="px-4 py-3 font-v2mono text-v2-subtle">{r.MES_ABONO}</td>
                      <td className="px-4 py-3 text-right font-v2mono text-v2-text">{Number(r.IMPORTE).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="text-sm text-v2-subtle px-4 py-4 m-0">Sin resultados todavía — hacé una búsqueda.</p>}
            </div>
          </div>

          <section className="flex flex-col gap-3.5 bg-v2-surface border border-v2-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-v2-text">Actualización retroactiva por Excel</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div style={{ minWidth: 280 }}>
                <label className={V2_LABEL}>Motivo de la edición</label>
                <input className={V2_INPUT} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. Corrección de categoría" />
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImportFile} className="text-xs text-v2-subtle" />
            </div>
            <span className="text-xs text-v2-subtle max-w-[520px]">El archivo debe traer TABLA, ID_GASTO, IMPORTE, MES_ABONO y CATEGORIA. Se valida formato y existencia de atributos antes de impactar; si hay al menos un error no se aplica nada.</span>
            {errores.length > 0 && (
              <div className="rounded-lg px-3 py-2.5 border border-v2-danger/30 bg-v2-danger/10">
                <strong className="text-v2-danger text-xs">Errores encontrados:</strong>
                <ul className="m-0 mt-1 pl-4 text-xs text-v2-danger">
                  {errores.map((er, i) => <li key={i}>Fila {er.fila}: {er.error}</li>)}
                </ul>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="bg-v2-surface border border-v2-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-v2-border">
            <h3 className="text-sm font-semibold text-v2-text m-0">Historial de actualizaciones masivas</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-v2-border">
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Fecha</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Motivo</th>
                <th className="text-right px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Registros</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.ID_HISTORIAL} className="border-b border-v2-border hover:bg-v2-panel transition-colors">
                  <td className="px-5 py-4 font-v2mono text-v2-text">{new Date(h.FECHA).toLocaleString('es-AR')}</td>
                  <td className="px-5 py-4 font-v2mono text-v2-subtle">{h.USUARIO}</td>
                  <td className="px-5 py-4 text-v2-text">{h.MOTIVO}</td>
                  <td className="px-5 py-4 text-right font-v2mono text-v2-text">{h.REGISTROS}</td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-medium ${
                      h.ESTADO === 'exitoso' ? 'bg-v2-success/15 text-v2-success' : 'bg-v2-danger/15 text-v2-danger'
                    }`}>
                      {h.ESTADO === 'exitoso' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {h.ESTADO.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
