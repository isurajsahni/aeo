import { authApi } from '../api/endpoints.js';
import { useAsync } from './useAsync.js';

/** Public app settings: is sign-up open, and the crawl page limits. Sensible defaults until loaded. */
export function useAuthConfig() {
  const { data } = useAsync((signal) => authApi.config({ signal }), []);
  return {
    registrationOpen: data?.registrationOpen ?? true,
    restricted: data?.restricted ?? false,
    crawl: data?.crawl ?? { defaultPages: 25, maxPages: 100 },
  };
}
