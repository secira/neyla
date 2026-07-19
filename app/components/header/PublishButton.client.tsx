import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { authUserAtom } from '~/lib/stores/auth';
import { chatId, description } from '~/lib/persistence/useChatHistory';
import { ensureServerWorkspace } from '~/lib/persistence/serverSync';
import { extractRelativePath } from '~/utils/diff';

interface DeploymentInfo {
  id: string;
  status: string;
  statusDetail?: string | null;
  error?: string | null;
  url?: string | null;
  bundleVersion: number;
  deployedVersion: number;
}

interface DeploymentResponse {
  deployment: DeploymentInfo | null;
  awsConfigured: boolean;
}

const STEPS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'provisioning', label: 'Setting up your server', statuses: ['provisioning'] },
  { key: 'booting', label: 'Starting the server', statuses: ['booting'] },
  { key: 'deploying', label: 'Installing and starting your app', statuses: ['deploying'] },
  { key: 'live', label: 'Live on the internet', statuses: ['live'] },
];

function stepState(stepIndex: number, status: string): 'done' | 'active' | 'pending' | 'error' {
  const order = ['provisioning', 'booting', 'deploying', 'live'];
  const currentIndex = order.indexOf(status);

  if (status === 'error') {
    return stepIndex === 0 ? 'error' : 'pending';
  }

  if (currentIndex === -1) {
    return 'pending';
  }

  if (stepIndex < currentIndex) {
    return 'done';
  }

  if (stepIndex === currentIndex) {
    return status === 'live' ? 'done' : 'active';
  }

  return 'pending';
}

async function fetchDeployment(workspaceId: string): Promise<DeploymentResponse | null> {
  try {
    const res = await fetch(`/api/deployments/workspace/${workspaceId}`, { credentials: 'include' });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as DeploymentResponse;
  } catch {
    return null;
  }
}

export function PublishButton() {
  const user = useStore(authUserAtom);
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [info, setInfo] = useState<DeploymentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deployment = info?.deployment || null;
  const inProgress = deployment ? ['provisioning', 'booting', 'deploying'].includes(deployment.status) : false;

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

  // Poll deployment status while the panel is open and a publish is in progress
  useEffect(() => {
    if (!open || !workspaceId || !inProgress) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      return undefined;
    }

    pollRef.current = setInterval(async () => {
      const fresh = await fetchDeployment(workspaceId);

      if (fresh) {
        setInfo(fresh);
      }
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, workspaceId, inProgress]);

  if (!user) {
    return null;
  }

  const openPanel = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setLoading(true);

    try {
      const urlId = chatId.get();

      if (!urlId) {
        return;
      }

      const wsId = await ensureServerWorkspace(urlId, description.get());

      if (!wsId) {
        return;
      }

      setWorkspaceId(wsId);

      const fresh = await fetchDeployment(wsId);
      setInfo(fresh);
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (publishing || !workspaceId) {
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
      toast.error('No files to publish yet. Build something first!');
      return;
    }

    setPublishing(true);

    try {
      const res = await fetch(`/api/deployments/workspace/${workspaceId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ files: payloadFiles }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish');
      }

      setInfo({ deployment: data.deployment, awsConfigured: true });
      toast.success('Publishing started!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        className="rounded-md items-center justify-center px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
        title="Publish to the internet"
      >
        <div className="i-ph:rocket-launch" />
        <span>Publish</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 shadow-lg z-50">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="i-svg-spinners:90-ring-with-bg" />
              <span>Checking your deployment…</span>
            </div>
          )}

          {!loading && info && !info.awsConfigured && (
            <p className="text-sm text-bolt-elements-textPrimary">
              Publishing is not set up yet. The site admin needs to add AWS credentials before apps can go live.
            </p>
          )}

          {!loading && info && info.awsConfigured && (
            <div className="flex flex-col gap-3">
              {!deployment && (
                <p className="text-sm text-bolt-elements-textPrimary">
                  Publish your app to its own server on Amazon EC2 and get a public link anyone can open.
                </p>
              )}

              {deployment && (deployment.status !== 'live' || inProgress) && deployment.status !== 'error' && (
                <div className="flex flex-col gap-2">
                  {STEPS.map((step, i) => {
                    const state = stepState(i, deployment.status);

                    return (
                      <div key={step.key} className="flex items-center gap-2 text-sm">
                        {state === 'done' && <div className="i-ph:check-circle text-green-500" />}
                        {state === 'active' && <div className="i-svg-spinners:90-ring-with-bg text-accent-500" />}
                        {state === 'pending' && <div className="i-ph:circle text-bolt-elements-textTertiary" />}
                        {state === 'error' && <div className="i-ph:x-circle text-red-500" />}
                        <span
                          className={
                            state === 'pending' ? 'text-bolt-elements-textTertiary' : 'text-bolt-elements-textPrimary'
                          }
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                  {deployment.statusDetail && (
                    <p className="text-xs text-bolt-elements-textTertiary">{deployment.statusDetail}</p>
                  )}
                </div>
              )}

              {deployment?.status === 'error' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <div className="i-ph:x-circle" />
                    <span>Publishing failed</span>
                  </div>
                  {deployment.error && <p className="text-xs text-bolt-elements-textTertiary">{deployment.error}</p>}
                </div>
              )}

              {deployment?.status === 'live' && deployment.url && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-bolt-elements-textPrimary">
                    <div className="i-ph:check-circle text-green-500" />
                    <span>Your app is live!</span>
                  </div>
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-3 py-2 text-sm border border-bolt-elements-borderColor text-bolt-elements-textPrimary flex items-center justify-center gap-2 hover:bg-bolt-elements-background-depth-3 break-all"
                  >
                    <div className="i-ph:arrow-square-out" />
                    <span>{deployment.url.replace(/^https?:\/\//, '')}</span>
                  </a>
                </div>
              )}

              <button
                onClick={publish}
                disabled={publishing || inProgress}
                className="rounded-md px-3 py-2 text-sm bg-accent-500 text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-bolt-elements-button-primary-backgroundHover"
              >
                {publishing || inProgress ? (
                  <>
                    <div className="i-svg-spinners:90-ring-with-bg" />
                    <span>{inProgress ? 'Publishing…' : 'Starting…'}</span>
                  </>
                ) : (
                  <>
                    <div className="i-ph:rocket-launch" />
                    <span>{deployment ? 'Publish update' : 'Publish'}</span>
                  </>
                )}
              </button>

              <p className="text-xs text-bolt-elements-textTertiary">
                First publish sets up a small server on Amazon EC2 (takes a few minutes). Updates are faster.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
