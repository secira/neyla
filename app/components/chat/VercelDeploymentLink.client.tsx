import { useStore } from '@nanostores/react';
import { vercelConnection } from '~/lib/stores/vercel';
import { chatId } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

export function VercelDeploymentLink() {
  const connection = useStore(vercelConnection);
  const currentChatId = useStore(chatId);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchProjectData() {
      if (!connection.user || !currentChatId) {
        return;
      }

      // Check if we have a stored project ID for this chat
      const projectId = localStorage.getItem(`vercel-project-${currentChatId}`);

      if (!projectId) {
        return;
      }

      setIsLoading(true);

      try {
        // The server resolves the Vercel credential from the authenticated connection.
        const fallbackResponse = await fetch(`/api/vercel-deploy?projectId=${encodeURIComponent(projectId)}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const data = await fallbackResponse.json();

        if ((data as { deploy?: { url?: string } }).deploy?.url) {
          setDeploymentUrl((data as { deploy: { url: string } }).deploy.url);
        } else if ((data as { project?: { url?: string } }).project?.url) {
          setDeploymentUrl((data as { project: { url: string } }).project.url);
        }
      } catch (err) {
        console.error('Error fetching Vercel deployment:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjectData();
  }, [connection.user, currentChatId]);

  if (!deploymentUrl) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-[#000000] z-50"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={`i-ph:link w-4 h-4 hover:text-blue-400 ${isLoading ? 'animate-pulse' : ''}`} />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-50"
            sideOffset={5}
          >
            {deploymentUrl}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
