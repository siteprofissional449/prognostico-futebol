import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminRouteGuard() {
  const { isLoggedIn, isAdmin } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
