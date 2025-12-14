import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // No-op; we validate JWTs directly in endpoints.
  return resolve(event);
};
