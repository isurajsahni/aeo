import { Link } from 'react-router';
import { buttonClasses } from '../components/ui/Button.jsx';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
      <Link to="/" className={buttonClasses({ className: 'mt-6' })}>
        Go home
      </Link>
    </div>
  );
}
