import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { chatId } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

export function NetlifyDeploymentLink() {
  const connection = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);
  const [deployedSite, setDeployedSite] = useState<{ id: string; name: string; url: string } | undefined>();

  useEffect(() => {
    async function fetchSites() {
      if (!connection.user || !currentChatId) {
        return;
      }

      try {
        const response = await fetch('/api/netlify-user', {
          method: 'POST',
          body: new URLSearchParams({ action: 'get_sites' }),
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { sites?: Array<{ id: string; name: string; url: string }> };
        const site = data.sites?.find((candidate) => candidate.name.includes(`bolt-diy-${currentChatId}`));

        if (site) {
          setDeployedSite(site);
        }
      } catch (error) {
        console.error('Error fetching Netlify deployment:', error);
      }
    }

    fetchSites();
  }, [connection.user, currentChatId]);

  if (!deployedSite) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={deployedSite.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-[#00AD9F] z-50"
            onClick={(e) => {
              e.stopPropagation(); // This is to prevent click from bubbling up
            }}
          >
            <div className="i-ph:link w-4 h-4 hover:text-blue-400" />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-50"
            sideOffset={5}
          >
            {deployedSite.url}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
