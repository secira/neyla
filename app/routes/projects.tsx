import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { authUserAtom, authLoadingAtom, fetchCurrentUser } from '~/lib/stores/auth';
import { listUserWorkspaces } from '~/lib/persistence/serverSync';

export const meta: MetaFunction = () => [
  { title: 'My Projects — Neyla' },
  { name: 'description', content: 'All your AI-generated projects in one place.' },
];

export const loader = () => json({});

type Workspace = {
  id: string;
  url_id: string;
  title: string;
  description?: string;
  updated_at: string;
};

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) {
    return 'just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

const GRADIENT = 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)';
const GRADIENT_FULL = 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)';

export default function Projects() {
  const navigate = useNavigate();
  const user = useStore(authUserAtom);
  const loading = useStore(authLoadingAtom);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      listUserWorkspaces().then((list) => {
        setWorkspaces(list as Workspace[]);
        setWsLoading(false);
      });
    }
  }, [user]);

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'My';

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1">
      <header className="flex items-center px-6 h-14 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 sticky top-0 z-10">
        <a href="/" className="flex items-center gap-1 mr-6 shrink-0">
          <span
            className="text-xl font-black tracking-tight"
            style={{ background: GRADIENT_FULL, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Neyla
          </span>
        </a>
        <span className="text-sm text-bolt-elements-textTertiary hidden sm:block">/ My Projects</span>
        <div className="flex-1" />
        <Link
          to="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
          style={{ background: GRADIENT }}
        >
          <div className="i-ph:plus-bold text-sm" />
          New Project
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">
            {firstName}'s Projects
          </h1>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            {wsLoading
              ? 'Loading…'
              : workspaces.length === 0
                ? 'No projects yet — start one below'
                : `${workspaces.length} project${workspaces.length !== 1 ? 's' : ''} • synced across all your devices`}
          </p>
        </div>

        {wsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 animate-pulse" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="i-ph:folder-open-duotone text-5xl text-bolt-elements-textTertiary mb-4" />
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">Start your first project</h2>
            <p className="text-sm text-bolt-elements-textSecondary mb-6 max-w-sm">
              Describe what you want to build — a website, app, landing page, or tool — and Neyla will generate it for you in seconds.
            </p>
            <Link
              to="/"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: GRADIENT }}
            >
              <div className="i-ph:plus-bold" />
              Build something
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <a
                key={ws.id}
                href={`/chat/${ws.url_id}`}
                className="group flex flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-orange-500/40 hover:shadow-lg transition-all p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.15) 0%, rgba(255,60,172,0.15) 100%)' }}
                  >
                    <div className="i-ph:code-block text-lg" style={{ color: '#FF6B2B' }} />
                  </div>
                  <span
                    className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    style={{ background: 'rgba(255,107,43,0.1)', color: '#FF6B2B' }}
                  >
                    Open <div className="i-ph:arrow-right text-xs" />
                  </span>
                </div>
                <h3 className="font-semibold text-bolt-elements-textPrimary text-sm mb-1 line-clamp-2 leading-snug">
                  {ws.title || 'Untitled project'}
                </h3>
                {ws.description && (
                  <p className="text-xs text-bolt-elements-textSecondary truncate mb-1">{ws.description}</p>
                )}
                <div className="mt-auto pt-3 border-t border-bolt-elements-borderColor/40 flex items-center gap-1.5 text-xs text-bolt-elements-textTertiary">
                  <div className="i-ph:clock text-xs" />
                  {timeAgo(ws.updated_at)}
                </div>
              </a>
            ))}

            <Link
              to="/"
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-bolt-elements-borderColor hover:border-orange-500/50 hover:bg-orange-500/5 transition-all p-5 min-h-[9rem] group"
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg mb-2 group-hover:scale-110 transition-transform"
                style={{ background: 'rgba(255,107,43,0.1)' }}
              >
                <div className="i-ph:plus-bold text-xl" style={{ color: '#FF6B2B' }} />
              </div>
              <span className="text-sm font-medium text-bolt-elements-textSecondary group-hover:text-orange-500 transition-colors">
                New project
              </span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
