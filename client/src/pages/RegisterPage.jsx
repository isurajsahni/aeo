import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { Button, buttonClasses } from '../components/ui/Button.jsx';
import { TextField } from '../components/ui/Field.jsx';
import { Alert } from '../components/ui/States.jsx';
import { useAuth } from '../context/auth.js';
import { useAuthConfig } from '../hooks/useAuthConfig.js';
import { AuthLayout } from './AuthLayout.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const { registrationOpen, restricted } = useAuthConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(form);
      navigate(location.state?.from?.pathname ?? '/projects', { replace: true });
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors : {};
      setFieldErrors(fields);
      if (!Object.keys(fields).length || err.code === 'EMAIL_TAKEN') setError(err.message);
      setSubmitting(false);
    }
  };

  if (!registrationOpen) {
    return (
      <AuthLayout title="Sign-ups are closed" subtitle="This workspace is invite-only. Ask your administrator for access.">
        <Link to="/login" className={buttonClasses({ className: 'w-full' })}>
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={restricted ? 'Sign-up is limited to invited email addresses.' : 'Start auditing client sites for AI search.'}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <TextField
          label="Name or agency"
          autoComplete="name"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          maxLength={80}
          required
        />
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
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
