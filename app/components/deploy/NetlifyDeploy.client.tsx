import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { formatBuildFailureOutput } from './deployUtils';

export function useNetlifyDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleNetlifyDeploy = async () => {
    if (!netlifyConn.user) {
      toast.error('Please connect to Netlify first in the settings tab!');
      return false;
    }

    if (!currentChatId) {
      toast.error('No active chat found');
      return false;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Create a deployment artifact for visual feedback
      const deploymentId = `deploy-artifact`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Netlify Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      // Notify that build is starting
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'netlify' });

      // Set up build action
      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'netlify build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      const buildOutput = artifact.runner.buildOutput;

      if (!buildOutput || buildOutput.exitCode !== 0) {
        // Notify that build failed
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: formatBuildFailureOutput(buildOutput?.output),
          source: 'netlify',
        });
        throw new Error('Build failed');
      }

      // Notify that build succeeded and deployment is starting
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });

      const storeFiles = workbenchStore.files.get();
      const rawBuildPath = buildOutput.path?.replace('/home/project', '') || '/dist';
      const candidateDirs = [rawBuildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

      let finalBuildPath = '/dist';

      for (const dir of candidateDirs) {
        const normalizedDir = dir.startsWith('/') ? dir : `/${dir}`;
        const hasFiles = Object.keys(storeFiles).some((f) => f.startsWith(normalizedDir + '/'));

        if (hasFiles) {
          finalBuildPath = normalizedDir;
          break;
        }
      }

      const fileContents: Record<string, string> = {};

      for (const [filePath, dirent] of Object.entries(storeFiles)) {
        if (!dirent || dirent.type !== 'file' || dirent.isBinary) {
          continue;
        }

        if (!filePath.startsWith(finalBuildPath + '/') && filePath !== finalBuildPath) {
          continue;
        }

        const deployPath = filePath.replace(finalBuildPath, '') || '/index.html';
        fileContents[deployPath] = dirent.content || '';
      }

      // Use chatId instead of artifact.id
      const existingSiteId = localStorage.getItem(`netlify-site-${currentChatId}`);

      const response = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: existingSiteId || undefined,
          files: fileContents,
          chatId: currentChatId,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.deploy || !data.site) {
        console.error('Invalid deploy response:', data);

        // Notify that deployment failed
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Invalid deployment response',
          source: 'netlify',
        });
        throw new Error(data.error || 'Invalid deployment response');
      }

      // Store the site ID if it's a new site
      if (data.site) {
        localStorage.setItem(`netlify-site-${currentChatId}`, data.site.id);
      }

      // Notify that deployment completed successfully
      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.deploy.url,
        source: 'netlify',
      });

      // Show success toast notification
      toast.success(`🚀 Netlify deployment completed successfully!`);

      return true;
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleNetlifyDeploy,
    isConnected: !!netlifyConn.user,
  };
}
