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
  const files = useStore(workbenchStore.files);
  const activePreview = previews[activePreviewIndex];
  const hasFiles = Object.values(files).some((f) => f?.type === 'file');

  const shouldShowButtons = activePreview || hasFiles;

  return (
    <div className="flex items-center gap-1">
      {shouldShowButtons && <SyncToGitHubButton />}
      {shouldShowButtons && <PublishButton />}
    </div>
  );
}
