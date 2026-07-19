import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { authUserAtom } from '~/lib/stores/auth';
import { chatId, description } from '~/lib/persistence/useChatHistory';
import { ensureServerWorkspace, getServerWorkspaceDetail } from '~/lib/persistence/serverSync';
import { openOAuthPopup, OAUTH_ERROR_MESSAGES } from '~/lib/utils/oauthPopup';
import { extractRelativePath } from '~/utils/diff';

interface GitHubStatus {
  connected: boolean;
  needsReauth?: boolean;
  username?: string;
  hasRepoScope?: boolean;
}

type Phase = 'idle' | 'checking' | 'connect' | 'form' | 'syncing' | 'done';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'neyla-project'
  );
}

async function fetchGitHubStatus(): Promise<GitHubStatus | null> {
  try {
    const res = await fetch('/api/auth/github/status', { credentials: 'include' });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as GitHubStatus;
  } catch {
    return null;
  }
}

export function SyncToGitHubButton() {
  const user = useStore(authUserAtom);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);

    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!user) {
    return null;
  }

  const openPanel = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setRepoUrl(null);
    setPhase('checking');

    const ghStatus = await fetchGitHubStatus();
    setStatus(ghStatus);

    if (!ghStatus || !ghStatus.connected || !ghStatus.hasRepoScope) {
      setPhase('connect');
      return;
    }

    await prepareForm();
  };

  const prepareForm = async () => {
    // Prefill from a previously linked repo when available
    let prefill = '';
    const urlId = chatId.get();

    if (urlId) {
      const workspaceId = await ensureServerWorkspace(urlId, description.get());

      if (workspaceId) {
        const detail = await getServerWorkspaceDetail(workspaceId);
        const gitUrl: string | undefined = detail?.workspace?.git_url;

        if (gitUrl) {
          prefill = gitUrl.split('/').pop() || '';
        }
      }
    }

    setRepoName(prefill || slugify(description.get() || 'neyla-project'));
    setPhase('form');
  };

  const connectGitHub = async () => {
    if (connecting) {
      return;
    }

    setConnecting(true);

    const { blocked, result } = openOAuthPopup('/api/auth/github');

    if (blocked) {
      setConnecting(false);
      toast.error('Popup was blocked. Please allow popups for this site and try again.');

      return;
    }

    const oauthResult = await result;
    setConnecting(false);

    if (!oauthResult) {
      return;
    }

    if (oauthResult.type === 'error') {
      toast.error(OAUTH_ERROR_MESSAGES[oauthResult.error || ''] || 'Failed to connect GitHub. Please try again.');
      return;
    }

    setPhase('checking');

    const ghStatus = await fetchGitHubStatus();
    setStatus(ghStatus);

    if (!ghStatus || !ghStatus.connected || !ghStatus.hasRepoScope) {
      setPhase('connect');
      toast.error('GitHub connection did not complete. Please try again.');

      return;
    }

    await prepareForm();
  };

  const doSync = async () => {
    const urlId = chatId.get();

    if (!urlId) {
      toast.error('Start a project before syncing to GitHub.');
      return;
    }

    const files = workbenchStore.files.get();
    const payloadFiles: Array<{ path: string; content: string }> = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        payloadFiles.push({ path: extractRelativePath(filePath), content: dirent.content });
      }
    }

    if (payloadFiles.length === 0) {
      toast.error('No files to sync yet. Build something first!');
      return;
    }

    setPhase('syncing');

    try {
      const workspaceId = await ensureServerWorkspace(urlId, description.get());

      if (!workspaceId) {
        throw new Error('Could not save your project to the cloud. Please try again.');
      }

      const res = await fetch(`/api/workspaces/${workspaceId}/github-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repoName: repoName.trim(),
          files: payloadFiles,
          commitMessage: `Sync from Neyla: ${description.get() || 'project update'}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'github_not_connected' || data.code === 'github_reauth') {
          setPhase('connect');
          setStatus(null);
          toast.error(data.error);

          return;
        }

        throw new Error(data.error || 'Failed to sync to GitHub');
      }

      setRepoUrl(data.repoUrl);
      setPhase('done');
      toast.success(data.created ? 'Repository created and synced!' : 'Synced to GitHub!');
    } catch (error) {
      setPhase('form');
      toast.error(error instanceof Error ? error.message : 'Failed to sync to GitHub');
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        className="rounded-md items-center justify-center px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
        title="Sync to GitHub"
      >
        <div className="i-ph:github-logo" />
        <span>Sync to GitHub</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 shadow-lg z-50">
          {phase === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="i-svg-spinners:90-ring-with-bg" />
              <span>Checking your GitHub connection…</span>
            </div>
          )}

          {phase === 'connect' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-bolt-elements-textPrimary">
                Connect your GitHub account to sync this project — no tokens or setup needed.
              </p>
              <button
                onClick={connectGitHub}
                disabled={connecting}
                className="rounded-md px-3 py-2 text-sm bg-accent-500 text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-bolt-elements-button-primary-backgroundHover"
              >
                {connecting ? <div className="i-svg-spinners:90-ring-with-bg" /> : <div className="i-ph:github-logo" />}
                <span>{connecting ? 'Waiting for GitHub…' : 'Connect GitHub'}</span>
              </button>
            </div>
          )}

          {(phase === 'form' || phase === 'syncing') && (
            <div className="flex flex-col gap-3">
              <label className="text-xs text-bolt-elements-textSecondary" htmlFor="neyla-repo-name">
                Repository name{status?.username ? ` (github.com/${status.username})` : ''}
              </label>
              <input
                id="neyla-repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={phase === 'syncing'}
                className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:border-accent-500"
                placeholder="my-project"
              />
              <button
                onClick={doSync}
                disabled={phase === 'syncing' || !repoName.trim()}
                className="rounded-md px-3 py-2 text-sm bg-accent-500 text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-bolt-elements-button-primary-backgroundHover"
              >
                {phase === 'syncing' ? (
                  <>
                    <div className="i-svg-spinners:90-ring-with-bg" />
                    <span>Syncing…</span>
                  </>
                ) : (
                  <>
                    <div className="i-ph:cloud-arrow-up" />
                    <span>Sync</span>
                  </>
                )}
              </button>
              <p className="text-xs text-bolt-elements-textTertiary">
                First sync creates a private repository. Later syncs push your latest files.
              </p>
            </div>
          )}

          {phase === 'done' && repoUrl && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-bolt-elements-textPrimary">
                <div className="i-ph:check-circle text-green-500" />
                <span>Synced to GitHub!</span>
              </div>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-2 text-sm border border-bolt-elements-borderColor text-bolt-elements-textPrimary flex items-center justify-center gap-2 hover:bg-bolt-elements-background-depth-3"
              >
                <div className="i-ph:arrow-square-out" />
                <span>View repository</span>
              </a>
              <button
                onClick={() => setPhase('form')}
                className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                Sync again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
