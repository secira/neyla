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

interface DeploymentLog {
  id: number;
  phase: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  createdAt: string;
}

interface DeploymentApiResponse {
  error?: string;
  deployment?: DeploymentInfo | null;
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

async function fetchDeploymentLogs(workspaceId: string): Promise<DeploymentLog[]> {
  try {
    const res = await fetch(`/api/deployments/workspace/${workspaceId}/logs`, { credentials: 'include' });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as { logs?: DeploymentLog[] };
    return Array.isArray(data.logs) ? data.logs : [];
  } catch {
    return [];
  }
}

export function PublishButton() {
  const user = useStore(authUserAtom);
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [info, setInfo] = useState<DeploymentResponse | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [revoking, setRevoking] = useState(false);
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
      const [fresh, freshLogs] = await Promise.all([fetchDeployment(workspaceId), fetchDeploymentLogs(workspaceId)]);

      if (fresh) {
        setInfo(fresh);
      }
      setLogs(freshLogs);
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

       const [fresh, freshLogs] = await Promise.all([fetchDeployment(wsId), fetchDeploymentLogs(wsId)]);
       setInfo(fresh);
       setLogs(freshLogs);
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

      const data = (await res.json()) as DeploymentApiResponse;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish');
      }

      setInfo({ deployment: data.deployment ?? null, awsConfigured: true });
      setLogs(await fetchDeploymentLogs(workspaceId));
      toast.success('Publishing started!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const revokeAgent = async () => {
    if (!workspaceId || !deployment || revoking || inProgress) {
      return;
    }

    if (
      !window.confirm(
        'Revoke this deployment credential? The current published server will be stopped, and you will need to publish again to reconnect it.',
      )
    ) {
      return;
    }

    setRevoking(true);

    try {
      const res = await fetch(`/api/deployments/workspace/${workspaceId}/revoke-agent`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as DeploymentApiResponse;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke deployment credential');
      }

      const fresh = await fetchDeployment(workspaceId);
      setInfo(fresh);
      setLogs(await fetchDeploymentLogs(workspaceId));
      toast.success('Deployment credential revoked. Publish again to reconnect your server.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke deployment credential');
    } finally {
      setRevoking(false);
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
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-bolt-elements-textPrimary">
                <div className="i-ph:cloud-slash text-amber-500" />
                <span>Publishing not yet configured</span>
              </div>
              <p className="text-xs text-bolt-elements-textSecondary">
                To enable publishing, add these two secrets in your Replit project settings:
              </p>
              <div className="rounded-md bg-bolt-elements-background-depth-3 px-3 py-2 font-mono text-xs text-bolt-elements-textPrimary flex flex-col gap-1">
                <span>AWS_ACCESS_KEY_ID</span>
                <span>AWS_SECRET_ACCESS_KEY</span>
              </div>
              <p className="text-xs text-bolt-elements-textTertiary">
                The IAM user needs EC2 permissions (RunInstances, DescribeInstances, DescribeImages, DescribeVpcs,
                DescribeSecurityGroups, CreateSecurityGroup, AuthorizeSecurityGroupIngress, CreateTags). Servers launch
                in ap-south-1 (Mumbai) by default — set <span className="font-mono">AWS_DEPLOY_REGION</span> to change
                it.
              </p>
            </div>
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

              {deployment && deployment.status !== 'error' && !inProgress && (
                <button
                  onClick={revokeAgent}
                  disabled={revoking}
                  className="rounded-md px-3 py-2 text-sm border border-red-300 text-red-600 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  {revoking ? (
                    <>
                      <div className="i-svg-spinners:90-ring-with-bg" />
                      <span>Revoking…</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:shield-warning" />
                      <span>Revoke deployment credential</span>
                    </>
                  )}
                </button>
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

              {deployment && logs.length > 0 && (
                <div className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-bolt-elements-textPrimary">Recent activity</span>
                    <span className="text-[10px] text-bolt-elements-textTertiary">{logs.length} events</span>
                  </div>
                  <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                    {logs
                      .slice(-8)
                      .reverse()
                      .map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-xs">
                          <div
                            className={
                              log.level === 'error'
                                ? 'i-ph:x-circle mt-0.5 text-red-500'
                                : log.level === 'success'
                                  ? 'i-ph:check-circle mt-0.5 text-green-500'
                                  : log.level === 'warning'
                                    ? 'i-ph:warning mt-0.5 text-amber-500'
                                    : 'i-ph:circle-dashed mt-0.5 text-bolt-elements-textTertiary'
                            }
                          />
                          <div className="min-w-0">
                            <div className="text-bolt-elements-textPrimary">{log.message}</div>
                            <div className="text-[10px] capitalize text-bolt-elements-textTertiary">{log.phase.replace('_', ' ')}</div>
                          </div>
                        </div>
                      ))}
                  </div>
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
                    <span>{deployment?.status === 'error' ? 'Publish with new credential' : deployment ? 'Publish update' : 'Publish'}</span>
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
