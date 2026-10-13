import { authApi } from '../api/endpoints.js';
import { useAsync } from './useAsync.js';

/** Public auth settings (is sign-up open?). Assumes open until the server says otherwise. */
export function useAuthConfig() {
  const { data } = useAsync((signal) => authApi.config({ signal }), []);
  return { registrationOpen: data?.registrationOpen ?? true, restricted: data?.restricted ?? false };
}
