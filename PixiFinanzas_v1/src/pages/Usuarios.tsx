import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

interface Usuario { ID_USUARIO: number; USUARIO: string; ROL: 'Rolemaster' | 'Consulta'; HABILITADO: number; NOMBRE: string; APELLIDO: string; DNI: string }

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

  function load() { api.get<Usuario[]>('/usuarios').then(setUsuarios); }
  useEffect(load, []);

  const isRolemaster = session?.rol === 'Rolemaster';

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
    <div className="flex flex-col gap-7">
      <h6 className="m-0 text-[13px] tracking-wide uppercase">Usuarios, roles y permisos</h6>

      {isRolemaster && (
        <form onSubmit={crear} className="flex flex-col gap-4">
          <span className="text-xs text-neutral-700">Dar de alta persona → dar de alta usuario</span>
          <div className="flex flex-wrap gap-3">
            <div className="field"><label>Nombre</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required /></div>
            <div className="field"><label>Apellido</label><input className="input" value={apellido} onChange={(e) => setApellido(e.target.value)} required /></div>
            <div className="field"><label>DNI</label><input className="input" value={dni} onChange={(e) => setDni(e.target.value)} required /></div>
            <div className="field"><label>Usuario</label><input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} required /></div>
            <div className="field"><label>Clave</label><input className="input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} required /></div>
            <div className="field"><label>Rol</label>
              <select className="input" value={rol} onChange={(e) => setRol(e.target.value as any)}>
                <option value="Consulta">Consulta</option>
                <option value="Rolemaster">Rolemaster</option>
              </select>
            </div>
            <button className="btn btn-primary self-end">Crear usuario</button>
          </div>
        </form>
      )}

      <table className="table">
        <thead><tr><th>Nombre</th><th>DNI</th><th>Usuario</th><th>Rol</th><th>Habilitado</th>{isRolemaster && <th />}</tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.ID_USUARIO}>
              <td>{u.NOMBRE} {u.APELLIDO}</td>
              <td>{u.DNI}</td>
              <td>{u.USUARIO}</td>
              <td>{u.ROL}</td>
              <td>{u.HABILITADO ? 'Sí' : 'No'}</td>
              {isRolemaster && (
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost text-xs" onClick={() => toggleHabilitado(u)}>
                    {u.HABILITADO ? 'Deshabilitar' : 'Habilitar'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
