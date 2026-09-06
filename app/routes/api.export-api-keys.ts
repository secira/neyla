import type { LoaderFunction } from '@remix-run/cloudflare';
export const loader: LoaderFunction = async () => {
  return Response.json(
    { error: 'Exporting provider credentials is disabled for security reasons.' },
    { status: 410 },
  );
};
