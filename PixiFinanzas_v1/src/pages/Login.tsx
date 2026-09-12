import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../lib/auth';

export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={(location.state as any)?.from?.pathname || '/'} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usuario, clave);
      navigate((location.state as any)?.from?.pathname || '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Usuario deshabilitado. Contactá a un Rolemaster.');
      else setError('Usuario o clave incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <form onSubmit={onSubmit} className="w-full max-w-[380px] flex flex-col gap-5 p-8" style={{ border: '2px solid var(--color-divider)', borderRadius: 8 }}>
        <img src="/logo-app.png" alt="PixiFinanzas" className="w-24 h-auto self-center" />
        <h2 className="m-0 text-center text-2xl">Ingresar</h2>
        {error && <div className="note" style={{ background: '#ffe0d9', borderColor: '#ffc4b8' }}>{error}</div>}
        <div className="field">
          <label htmlFor="usuario">Usuario</label>
          <input id="usuario" className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="clave">Clave</label>
          <input id="clave" type="password" className="input" value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !usuario || !clave}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
