import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { authUserAtom, authLoadingAtom, fetchCurrentUser, logout } from '~/lib/stores/auth';

export function HeaderUserMenu() {
  const user = useStore(authUserAtom);
  const loading = useStore(authLoadingAtom);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-bolt-elements-background-depth-3 animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/login"
          className="text-sm font-semibold px-4 py-1.5 rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-orange-400 transition-colors"
        >
          Sign in
        </a>
        <a
          href="/signup"
          className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-all hover:opacity-90 hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
        >
          Get started
        </a>
      </div>
    );
  }

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bolt-elements-background-depth-3 transition-colors"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.name || ''} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
          >
            {initials}
          </div>
        )}
        <span className="text-sm font-medium text-bolt-elements-textPrimary hidden sm:block">
          {user.name || user.email}
        </span>
        <div className="i-ph:caret-down text-xs text-bolt-elements-textSecondary" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
            <p className="text-sm font-semibold text-bolt-elements-textPrimary truncate">
              {user.name || 'User'}
            </p>
            <p className="text-xs text-bolt-elements-textSecondary truncate mt-0.5">{user.email}</p>
          </div>

          <div className="py-1">
            <a
              href="/projects"
              className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              onClick={() => setOpen(false)}
            >
              <div className="i-ph:squares-four text-base" />
              My Projects
            </a>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              onClick={() => setOpen(false)}
            >
              <div className="i-ph:plus-circle text-base" />
              New Project
            </a>
            <a
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              onClick={() => setOpen(false)}
            >
              <div className="i-ph:crown-simple-fill text-base text-orange-500" />
              Upgrade plan
            </a>
            <a
              href="/invoices"
              className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              onClick={() => setOpen(false)}
            >
              <div className="i-ph:receipt text-base" />
              Invoices
            </a>
          </div>

          <div className="py-1 border-t border-bolt-elements-borderColor">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <div className="i-ph:sign-out text-base" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
