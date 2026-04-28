import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { appTheme } from './theme/appTheme';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { AdminShell } from './components/AdminShell';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Premium = lazy(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));
const Planos = lazy(() => import('./pages/Planos').then((m) => ({ default: m.Planos })));
const Prognosticos = lazy(() => import('./pages/Prognosticos').then((m) => ({ default: m.Prognosticos })));
const HistoricoAcertos = lazy(() =>
  import('./pages/HistoricoAcertos').then((m) => ({ default: m.HistoricoAcertos })),
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const AdminUsers = lazy(() => import('./pages/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminPrognosticos = lazy(() =>
  import('./pages/AdminPrognosticos').then((m) => ({ default: m.AdminPrognosticos })),
);
const AdminCommercials = lazy(() =>
  import('./pages/AdminCommercials').then((m) => ({ default: m.AdminCommercials })),
);

function PageLoadingFallback() {
  return (
    <Center mih="45vh" py="xl">
      <Loader type="oval" size="md" color="#22C55E" />
    </Center>
  );
}

function App() {
  return (
    <MantineProvider theme={appTheme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="premium" element={<Premium />} />
                <Route path="planos" element={<Planos />} />
                <Route path="prognosticos" element={<Prognosticos />} />
                <Route path="historico" element={<HistoricoAcertos />} />
                <Route path="admin" element={<AdminRouteGuard />}>
                  <Route element={<AdminShell />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="usuarios" element={<AdminUsers />} />
                    <Route path="prognosticos" element={<AdminPrognosticos />} />
                    <Route path="comerciais" element={<AdminCommercials />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
