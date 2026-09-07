import { atom, computed } from 'nanostores';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at?: string;
}

const DEFAULT_ADMIN_EMAIL = 'udayid@gmail.com';

export const authUserAtom = atom<AuthUser | null | undefined>(undefined);
export const authLoadingAtom = atom<boolean>(true);

export const isAuthenticatedAtom = computed(authUserAtom, (user) => user != null);

export function isDefaultAdmin(user: Pick<AuthUser, 'email'> | null | undefined): boolean {
  return user?.email?.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL;
}

export async function fetchCurrentUser(): Promise<void> {
  authLoadingAtom.set(true);

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });

    if (res.ok) {
      const data = await res.json() as { user: AuthUser };
      authUserAtom.set(data.user);
    } else {
      authUserAtom.set(null);
    }
  } catch {
    authUserAtom.set(null);
  } finally {
    authLoadingAtom.set(false);
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  authUserAtom.set(null);
  window.location.href = '/login';
}
