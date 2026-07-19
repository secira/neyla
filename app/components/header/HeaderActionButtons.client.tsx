import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { SyncToGitHubButton } from './SyncToGitHubButton.client';
import { PublishButton } from './PublishButton.client';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const shouldShowButtons = activePreview;

  return (
    <div className="flex items-center gap-1">
      {/* Sync to GitHub */}
      {shouldShowButtons && <SyncToGitHubButton />}

      {/* Publish to EC2 */}
      {shouldShowButtons && <PublishButton />}
    </div>
  );
}
