import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Search, PlusCircle, Settings, BarChart2, LogOut, ChevronRight, Wallet, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import ConfirmDialog from './ConfirmDialog';

const NAV_ITEMS = [
  { to: '/', label: 'Home · Indicadores', badge: '', icon: Home },
  { to: '/costos', label: 'Costos Fijos y Variables', badge: '', icon: TrendingUp },
  { to: '/consultas', label: 'Consultas Retroactivas', badge: '', rolemasterOnly: false, icon: Search },
  { to: '/altas', label: 'Alta de Gastos', badge: '', icon: PlusCircle },
  { to: '/configuraciones', label: 'Configuraciones', badge: '', icon: Settings },
  { to: '/inversiones', label: 'Inversiones', badge: 'PRÓXIMAMENTE', icon: BarChart2 },
];

function greeting(nombre: string) {
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${saludo}, ${nombre.split(' ')[0]}`;
}

function initials(nombre?: string) {
  if (!nombre) return '';
  return nombre.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
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
      <aside className="w-64 flex-none min-h-screen bg-v2-bg border-r border-v2-border flex flex-col font-v2sans">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-v2-border">
          <div className="w-8 h-8 rounded-lg bg-v2-accent flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-v2-bg" />
          </div>
          <div className="leading-none">
            <span className="text-v2-text font-bold text-lg tracking-tight">Pixi</span>
            <span className="text-v2-accent font-bold text-lg tracking-tight">Finanzas</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-v2-accent/10 text-v2-accent border-v2-accent/30'
                    : 'text-v2-subtle border-transparent hover:text-v2-text hover:bg-v2-panel'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={16} className="shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-v2mono uppercase tracking-wider text-v2-subtle bg-v2-panel px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} className="shrink-0 text-v2-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-v2-border">
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="w-7 h-7 rounded-full bg-v2-accent2/15 border border-v2-accent2/30 flex items-center justify-center shrink-0">
              <span className="text-v2-accent2 text-xs font-bold">{initials(session?.nombre)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-v2-text truncate m-0">{session?.nombre}</p>
              <p className="text-[10px] text-v2-subtle font-v2mono uppercase m-0">{session?.usuario} · {session?.rol}</p>
            </div>
            <button
              className="text-v2-subtle hover:text-v2-danger transition-colors"
              title="Cerrar sesión"
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-end justify-between gap-6 px-8 pt-6 pb-4 bg-v2-bg border-b border-v2-border font-v2sans">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] tracking-widest uppercase text-v2-subtle font-v2mono">{KICKERS[location.pathname] || 'PixiFinanzas'}</span>
            <h2 className="m-0 text-2xl font-bold text-v2-text">{session ? greeting(session.nombre) : 'PixiFinanzas'}</h2>
            <span className="text-[13px] text-v2-subtle font-v2mono">{today}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-wide uppercase text-v2-subtle font-v2mono">Sesión expira en {sessionLeft}</span>
            <button
              className="flex items-center gap-2 bg-v2-accent hover:bg-v2-accent/90 text-v2-bg font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
              onClick={onRefresh}
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
            <button
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-v2-border text-v2-subtle hover:text-v2-text hover:bg-v2-panel transition-colors"
              title="Configuraciones"
              onClick={() => navigate('/configuraciones')}
            >
              <Settings size={16} />
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
