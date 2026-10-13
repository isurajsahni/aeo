import { useCallback, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '../api/client.js';
import { authApi } from '../api/endpoints.js';
import { AuthContext } from './auth.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until we know whether a session cookie is present.
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'));

    // Any 401 from a protected endpoint means the session is gone.
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (credentials) => {
    const { user } = await authApi.login(credentials);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { user } = await authApi.register(data);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading: status === 'loading', login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
