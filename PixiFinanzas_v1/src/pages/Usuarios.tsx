import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

interface Usuario { ID_USUARIO: number; USUARIO: string; ROL: 'Rolemaster' | 'Consulta'; HABILITADO: number; NOMBRE: string; APELLIDO: string; DNI: string }

const V2_LABEL = 'text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider mb-1.5 block';
const V2_INPUT = 'w-full bg-v2-bg border border-v2-border rounded-lg px-3 py-2 text-sm text-v2-text focus:outline-none focus:border-v2-accent transition-colors';

export default function Usuarios() {
  const { session } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState<'Rolemaster' | 'Consulta'>('Consulta');

  const isRolemaster = session?.rol === 'Rolemaster';

  // El listado incluye el DNI de cada persona, así que el backend solo lo
  // entrega a Rolemaster — evitamos el fetch (y su 403) para el resto.
  function load() {
    if (isRolemaster) api.get<Usuario[]>('/usuarios').then(setUsuarios);
  }
  useEffect(load, [isRolemaster]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/usuarios', { nombre, apellido, dni, usuario, clave, rol });
      toast('Usuario creado con HABILITADO = SI');
      setNombre(''); setApellido(''); setDni(''); setUsuario(''); setClave('');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Error al crear usuario');
    }
  }

  async function toggleHabilitado(u: Usuario) {
    await api.put(`/usuarios/${u.ID_USUARIO}/habilitado`, { habilitado: !u.HABILITADO });
    load();
  }

  return (
    <div className="flex flex-col gap-6 font-v2sans">
      <div className="bg-v2-surface border border-v2-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-v2-text m-0">Usuarios, roles y permisos</h1>
        <p className="text-sm text-v2-subtle mt-0.5 mb-0">Alta de personas y control de acceso al sistema</p>
      </div>

      {isRolemaster && (
        <form onSubmit={crear} className="flex flex-col gap-3 bg-v2-surface border border-v2-border rounded-xl p-5">
          <span className="text-xs text-v2-subtle">Dar de alta persona → dar de alta usuario</span>
          <div className="flex flex-wrap items-end gap-3">
            <div style={{ minWidth: 140 }}>
              <label className={V2_LABEL}>Nombre</label>
              <input className={V2_INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className={V2_LABEL}>Apellido</label>
              <input className={V2_INPUT} value={apellido} onChange={(e) => setApellido(e.target.value)} required />
            </div>
            <div style={{ minWidth: 120 }}>
              <label className={V2_LABEL}>DNI</label>
              <input className={V2_INPUT} value={dni} onChange={(e) => setDni(e.target.value)} required />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className={V2_LABEL}>Usuario</label>
              <input className={V2_INPUT} value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className={V2_LABEL}>Clave</label>
              <input className={V2_INPUT} type="password" value={clave} onChange={(e) => setClave(e.target.value)} required />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className={V2_LABEL}>Rol</label>
              <select className={V2_INPUT} value={rol} onChange={(e) => setRol(e.target.value as any)}>
                <option value="Consulta">Consulta</option>
                <option value="Rolemaster">Rolemaster</option>
              </select>
            </div>
            <button className="bg-v2-accent hover:bg-v2-accent/90 text-v2-bg font-semibold rounded-lg px-5 py-2 text-sm transition-colors">Crear usuario</button>
          </div>
        </form>
      )}

      {isRolemaster ? (
        <div className="bg-v2-surface border border-v2-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-v2-border">
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Nombre</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">DNI</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Rol</th>
                <th className="text-left px-5 py-3 text-[10px] font-v2mono text-v2-subtle uppercase tracking-wider">Habilitado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.ID_USUARIO} className="border-b border-v2-border hover:bg-v2-panel transition-colors">
                  <td className="px-5 py-3 text-v2-text">{u.NOMBRE} {u.APELLIDO}</td>
                  <td className="px-5 py-3 font-v2mono text-v2-subtle">{u.DNI}</td>
                  <td className="px-5 py-3 font-v2mono text-v2-text">{u.USUARIO}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.ROL === 'Rolemaster' ? 'bg-v2-accent2/15 text-v2-accent2' : 'bg-v2-panel text-v2-subtle'}`}>{u.ROL}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.HABILITADO ? 'bg-v2-success/15 text-v2-success' : 'bg-v2-danger/15 text-v2-danger'}`}>
                      {u.HABILITADO ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button className="text-v2-subtle hover:text-v2-accent transition-colors text-xs" onClick={() => toggleHabilitado(u)}>
                      {u.HABILITADO ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="text-xs text-v2-subtle bg-v2-surface border border-v2-border rounded-xl px-4 py-3">Esta sección requiere el rol Rolemaster.</span>
      )}
    </div>
  );
}
