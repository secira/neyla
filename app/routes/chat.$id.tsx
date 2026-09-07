import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { BuilderRail } from '~/components/builder/BuilderRail';

export async function loader(args: LoaderFunctionArgs) {
  return json({ id: args.params.id });
}

export default function ChatWorkspace() {
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-bolt-elements-background-depth-1">
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <BuilderRail />
        <div className="min-w-0 flex-1 overflow-hidden">
          <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
        </div>
      </div>
    </div>
  );
}
