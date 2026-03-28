import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import SkechBackground from '~/components/ui/SkechBackground';
import { Footer } from '~/components/layout/Footer';

export const meta: MetaFunction = () => {
  return [
    { title: 'Skech — Build with AI, made for India' },
    { name: 'description', content: 'Create websites, apps, and prototypes with AI. Built for the Indian community.' },
  ];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col min-h-full w-full bg-bolt-elements-background-depth-1 relative">
      <SkechBackground />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      <Footer />
    </div>
  );
}
