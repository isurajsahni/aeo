const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

/** Error thrown for any non-2xx API response. Mirrors the server's { error } envelope. */
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }

  /** Field errors keyed by top-level field name: { email: 'Enter a valid email' }. */
  get fieldErrors() {
    const errors = {};
    for (const { path, message } of this.details) {
      const field = path?.split('.')[0];
      if (field && !errors[field]) errors[field] = message;
    }
    return errors;
  }
}

let onUnauthorized = () => {};
/** Lets the auth context react to an expired session anywhere in the app. */
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', { status: 0, code: 'NETWORK_ERROR' });
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(error.message ?? `Request failed (${response.status})`, {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
