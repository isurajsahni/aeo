import { createContext, useContext } from 'react';

/**
 * Kept separate from AuthProvider so AuthContext.jsx exports only a component,
 * which keeps Vite Fast Refresh working when the provider is edited.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
