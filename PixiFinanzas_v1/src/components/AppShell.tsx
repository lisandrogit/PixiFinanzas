import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import ConfirmDialog from './ConfirmDialog';

const NAV_ITEMS = [
  { to: '/', label: 'Home · Indicadores', badge: '' },
  { to: '/costos', label: 'Costos Fijos y Variables', badge: '' },
  { to: '/consultas', label: 'Consultas Retroactivas', badge: '', rolemasterOnly: false },
  { to: '/altas', label: 'Alta de Gastos', badge: '' },
  { to: '/configuraciones', label: 'Configuraciones', badge: '' },
  { to: '/inversiones', label: 'Inversiones', badge: 'PRÓXIMAMENTE' },
];

function greeting(nombre: string) {
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${saludo}, ${nombre.split(' ')[0]}`;
}

const KICKERS: Record<string, string> = {
  '/': 'Home',
  '/costos': 'Gastos',
  '/consultas': 'Gastos',
  '/altas': 'Gastos',
  '/configuraciones': 'Configuraciones',
  '/usuarios': 'Configuraciones',
  '/inversiones': 'Inversiones',
};

export default function AppShell({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => void }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const today = useMemo(() => new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }), []);
  const sessionLeft = session ? `${Math.max(0, Math.floor(session.secondsLeft / 60))} min` : '';

  return (
    <div className="flex w-full min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <aside className="w-[246px] flex-none border-r-2 flex flex-col" style={{ borderColor: 'var(--color-divider)' }}>
        <div className="p-5 pb-4 border-b-2" style={{ borderColor: 'var(--color-divider)' }}>
          <img src="/logo-app.png" alt="PixiFinanzas" className="w-[104px] h-auto" />
        </div>
        <nav className="flex flex-col py-3 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-5 py-3 text-left hover:bg-accent-100 ${
                  isActive ? 'border-l-4' : 'border-l-4 border-transparent'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { borderColor: 'var(--color-accent)', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)' }
                  : {}
              }
            >
              <span className="flex items-center gap-2 text-[13px] tracking-wide uppercase font-extrabold">{item.label}</span>
              {item.badge && <span className="text-[10px] tracking-wider text-neutral-600">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-5 border-t-2 flex flex-col gap-1.5" style={{ borderColor: 'var(--color-divider)' }}>
          <span className="text-[13px] font-extrabold">{session?.nombre}</span>
          <span className="text-[11px] tracking-wide uppercase text-neutral-600">{session?.usuario} · {session?.rol}</span>
          <button className="btn btn-ghost justify-start pl-0 text-[12px]" onClick={() => setConfirmLogout(true)}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-end justify-between gap-6 px-8 pt-6 pb-4 border-b-2" style={{ borderColor: 'var(--color-divider)' }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] tracking-widest uppercase text-neutral-600">{KICKERS[location.pathname] || 'PixiFinanzas'}</span>
            <h2 className="m-0 text-[30px]">{session ? greeting(session.nombre) : 'PixiFinanzas'}</h2>
            <span className="text-[13px] text-neutral-700">{today}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] tracking-wide uppercase text-neutral-600">Sesión expira en {sessionLeft}</span>
            <button className="btn btn-primary" onClick={onRefresh}>ACTUALIZAR</button>
            <button className="btn btn-secondary" title="Configuraciones" onClick={() => navigate('/configuraciones')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.38.42.7.79.9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex-1 min-w-0 p-8 pb-14">{children}</div>
      </main>

      {confirmLogout && (
        <ConfirmDialog
          title="Cerrar sesión"
          body="¿Confirmás que querés cerrar tu sesión?"
          okLabel="Cerrar sesión"
          onConfirm={async () => { await logout(); navigate('/login'); }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
