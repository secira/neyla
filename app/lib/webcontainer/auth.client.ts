/**
 * Auth stub — WebContainer auth is no longer used (replaced by E2B).
 * Kept for compatibility with existing imports.
 */

export const auth = {
  login: async () => {},
  logout: async () => {},
};

export type AuthAPI = typeof auth;
