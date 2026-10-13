import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.jsx';
import { TextField } from '../components/ui/Field.jsx';
import { Alert } from '../components/ui/States.jsx';
import { useAuth } from '../context/auth.js';
import { useAuthConfig } from '../hooks/useAuthConfig.js';
import { AuthLayout } from './AuthLayout.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const { registrationOpen } = useAuthConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      await login(form);
      navigate(location.state?.from?.pathname ?? '/projects', { replace: true });
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors : {};
      setFieldErrors(fields);
      if (!Object.keys(fields).length) setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your client audits."
      footer={
        registrationOpen && (
          <>
            New to AEO Audit?{' '}
            <Link to="/register" state={location.state} className="font-medium text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
