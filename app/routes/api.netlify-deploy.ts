import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import crypto from 'crypto';
import type { NetlifySiteInfo } from '~/types/netlify';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

interface DeployRequestBody {
  siteId?: string;
  files: Record<string, string>;
  chatId: string;
}

function getNetlifyToken(request: Request, context: any): string | undefined {
  const apiKeys = getApiKeysFromCookie(request.headers.get('Cookie'));

  return (
    apiKeys.VITE_NETLIFY_ACCESS_TOKEN ||
    context?.cloudflare?.env?.VITE_NETLIFY_ACCESS_TOKEN ||
    process.env.VITE_NETLIFY_ACCESS_TOKEN
  );
}

function connectionError(response: Response, operation: string) {
  if (response.status === 401 || response.status === 403) {
    return json({ error: 'Your Netlify connection expired. Reconnect Netlify in Settings and try again.' }, { status: 401 });
  }

  return json({ error: `Failed to ${operation}` }, { status: response.status >= 400 ? response.status : 500 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const { siteId, files, chatId } = (await request.json()) as DeployRequestBody;
    const token = getNetlifyToken(request, context);

    if (!token) {
      return json({ error: 'Netlify is not connected. Connect Netlify in Settings and try again.' }, { status: 401 });
    }

    let targetSiteId = siteId;
    let siteInfo: NetlifySiteInfo | undefined;

    // If no siteId provided, create a new site
    if (!targetSiteId) {
      const siteName = `bolt-diy-${chatId}-${Date.now()}`;
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: siteName,
          custom_domain: null,
        }),
      });

      if (!createSiteResponse.ok) {
        return connectionError(createSiteResponse, 'create the Netlify site');
      }

      const newSite = (await createSiteResponse.json()) as any;
      targetSiteId = newSite.id;
      siteInfo = {
        id: newSite.id,
        name: newSite.name,
        url: newSite.url,
        chatId,
      };
    } else {
      // Get existing site info
      if (targetSiteId) {
        const siteResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (siteResponse.ok) {
          const existingSite = (await siteResponse.json()) as any;
          siteInfo = {
            id: existingSite.id,
            name: existingSite.name,
            url: existingSite.url,
            chatId,
          };
        } else {
          if (siteResponse.status === 401 || siteResponse.status === 403) {
            return connectionError(siteResponse, 'load the Netlify site');
          }
          targetSiteId = undefined;
        }
      }

      // If no siteId provided or site doesn't exist, create a new site
      if (!targetSiteId) {
        const siteName = `bolt-diy-${chatId}-${Date.now()}`;
        const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: siteName,
            custom_domain: null,
          }),
        });

        if (!createSiteResponse.ok) {
          return connectionError(createSiteResponse, 'create the Netlify site');
        }

        const newSite = (await createSiteResponse.json()) as any;
        targetSiteId = newSite.id;
        siteInfo = {
          id: newSite.id,
          name: newSite.name,
          url: newSite.url,
          chatId,
        };
      }
    }

    // Create file digests
    const fileDigests: Record<string, string> = {};

    for (const [filePath, content] of Object.entries(files)) {
      // Ensure file path starts with a forward slash
      const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      fileDigests[normalizedPath] = hash;
    }

    // Create a new deploy with digests
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: fileDigests,
        async: true,
        skip_processing: false,
        draft: false, // Change this to false for production deployments
        function_schedules: [],
        framework: null,
      }),
    });

    if (!deployResponse.ok) {
      return connectionError(deployResponse, 'create the Netlify deployment');
    }

    const deploy = (await deployResponse.json()) as any;
    let retryCount = 0;
    const maxRetries = 60;
    let filesUploaded = false;

    // Poll until deploy is ready for file uploads
    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!statusResponse.ok) {
        return connectionError(statusResponse, 'check the Netlify deployment');
      }

      const status = (await statusResponse.json()) as any;

      if (!filesUploaded && (status.state === 'prepared' || status.state === 'uploaded')) {
        // Upload all files regardless of required array
        for (const [filePath, content] of Object.entries(files)) {
          const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
          const encodedPath = normalizedPath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');

          let uploadSuccess = false;
          let uploadRetries = 0;

          while (!uploadSuccess && uploadRetries < 3) {
            try {
              const uploadResponse = await fetch(
                `https://api.netlify.com/api/v1/deploys/${deploy.id}/files${encodedPath}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream',
                  },
                  body: content,
                },
              );

              uploadSuccess = uploadResponse.ok;

              if (!uploadSuccess) {
                if (uploadResponse.status === 401 || uploadResponse.status === 403) {
                  return connectionError(uploadResponse, 'upload the Netlify deployment files');
                }

                console.error('Upload failed:', await uploadResponse.text());
                uploadRetries++;
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            } catch (error) {
              console.error('Upload error:', error);
              uploadRetries++;
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          if (!uploadSuccess) {
            return json({ error: `Failed to upload file ${filePath}` }, { status: 500 });
          }
        }

        filesUploaded = true;
      }

      if (status.state === 'ready') {
        // Only return after files are uploaded
        return json({
          success: true,
          deploy: {
            id: status.id,
            state: status.state,
            url: status.ssl_url || status.url,
          },
          site: siteInfo,
        });
      }

      if (status.state === 'error') {
        return json({ error: status.error_message || 'Deploy preparation failed' }, { status: 500 });
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (retryCount >= maxRetries) {
      return json({ error: 'Deploy preparation timed out' }, { status: 500 });
    }

    // Make sure we're returning the deploy ID and site info
    return json({
      success: true,
      deploy: {
        id: deploy.id,
        state: deploy.state,
      },
      site: siteInfo,
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return json({ error: 'Deployment failed' }, { status: 500 });
  }
}
