import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/auth.js';
import { PageLoader } from '../ui/States.jsx';

/** Only signed-in users; others are sent to /login and returned afterwards. */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Only signed-out users (login/register); signed-in users go to where they were headed. */
export function GuestRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to={location.state?.from?.pathname ?? '/projects'} replace />;
  return <Outlet />;
}
