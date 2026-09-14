import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth, ApiError } from '../lib/auth';
import SpaceBackground from '../components/SpaceBackground';

export default function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
    <div className="relative min-h-screen overflow-hidden flex items-center justify-end pr-20 font-v2sans">
      <SpaceBackground />

      <div className="absolute bottom-16 left-[200px] text-center pointer-events-none select-none">
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#4fb3f680] to-transparent mx-auto mb-2" />
        <p className="text-[11px] font-v2mono text-[#4fb3f6] tracking-[0.2em] opacity-60 uppercase">Tierra</p>
      </div>
      <div className="absolute top-[118px] right-[130px] pointer-events-none select-none">
        <p className="text-[10px] font-v2mono text-[#ffe08a] tracking-[0.18em] opacity-50 uppercase">Sol</p>
        <div className="w-px h-8 bg-gradient-to-b from-[#ffe08a60] to-transparent mx-auto mt-1" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'rgba(14, 17, 28, 0.78)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-v2-accent flex items-center justify-center shadow-lg shadow-v2-accent/25">
              <Wallet size={20} className="text-v2-bg" />
            </div>
            <div>
              <span className="text-v2-text font-bold text-2xl tracking-tight">Pixi</span>
              <span className="text-v2-accent font-bold text-2xl tracking-tight">Finanzas</span>
            </div>
          </div>

          <h2 className="text-v2-text text-xl font-semibold mb-1">Iniciar sesión</h2>
          <p className="text-v2-subtle text-sm mb-7">Accedé con tus credenciales</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="usuario" className="block text-[10px] font-v2mono font-medium text-v2-subtle mb-1.5 uppercase tracking-wider">
                Usuario
              </label>
              <input
                id="usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
                className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm text-v2-text placeholder-[#3a4060] bg-black/35 focus:outline-none focus:border-v2-accent transition-colors font-v2mono"
              />
            </div>
            <div>
              <label htmlFor="clave" className="block text-[10px] font-v2mono font-medium text-v2-subtle mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="clave"
                  type={showPass ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  className="w-full border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-sm text-v2-text placeholder-[#3a4060] bg-black/35 focus:outline-none focus:border-v2-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-v2-subtle hover:text-v2-text transition-colors"
                  title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 border border-v2-danger/30 bg-v2-danger/10">
                <AlertCircle size={14} className="text-v2-danger shrink-0" />
                <p className="text-v2-danger text-xs m-0">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !usuario || !clave}
              className="w-full bg-v2-accent hover:bg-v2-accent/90 disabled:opacity-60 text-v2-bg font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
              style={{ boxShadow: '0 0 24px rgba(0,212,170,0.25)' }}
            >
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#3a4060] text-[10px] mt-5 font-v2mono tracking-wider">
          PixiFinanzas v1.0 · Módulo Gastos
        </p>
      </div>
    </div>
  );
}
