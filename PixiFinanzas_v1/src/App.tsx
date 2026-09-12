import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Home from './pages/Home';
import Costos from './pages/Costos';
import Consultas from './pages/Consultas';
import AltaGastos from './pages/AltaGastos';
import Configuraciones from './pages/Configuraciones';
import Usuarios from './pages/Usuarios';
import Inversiones from './pages/Inversiones';

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell onRefresh={bump}>
              <Routes>
                <Route path="/" element={<Home refreshKey={refreshKey} />} />
                <Route path="/costos" element={<Costos refreshKey={refreshKey} />} />
                <Route path="/consultas" element={<Consultas />} />
                <Route path="/altas" element={<AltaGastos />} />
                <Route path="/configuraciones" element={<Configuraciones />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/inversiones" element={<Inversiones />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  );
}
