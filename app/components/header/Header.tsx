import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { HeaderUserMenu } from './HeaderUserMenu.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'flex items-center px-4 sm:px-6 border-b h-[var(--header-height)] z-50',
        {
          'border-transparent backdrop-blur-sm bg-white/80 dark:bg-gray-950/80': !chat.started,
          'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl text-bolt-elements-textSecondary" />
        <a href="/" className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <span
              className="text-2xl font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Skech
            </span>
            <span className="text-[10px] font-semibold text-white bg-gradient-to-r from-orange-500 to-pink-500 px-1.5 py-0.5 rounded-full leading-none mb-1">
              beta
            </span>
          </div>
        </a>
      </div>

      {chat.started && (
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="flex items-center gap-3">
                <HeaderActionButtons chatStarted={chat.started} />
                <HeaderUserMenu />
              </div>
            )}
          </ClientOnly>
        </>
      )}

      {!chat.started && (
        <div className="flex-1 flex items-center justify-end gap-3">
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-bolt-elements-textSecondary">
            <a href="/features" className="hover:text-bolt-elements-textPrimary transition-colors">Features</a>
            <a href="/examples" className="hover:text-bolt-elements-textPrimary transition-colors">Examples</a>
            <a href="/community" className="hover:text-bolt-elements-textPrimary transition-colors">Community</a>
            <a
              href="/pricing"
              className="flex items-center gap-1 hover:text-bolt-elements-textPrimary transition-colors font-semibold"
              style={{ color: '#FF6B2B' }}
            >
              <div className="i-ph:crown-simple-fill text-base" />
              Pricing
            </a>
          </nav>
          <ClientOnly
            fallback={
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  className="text-sm font-semibold px-4 py-1.5 rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-orange-400 transition-colors"
                >
                  Sign in
                </a>
                <a
                  href="/signup"
                  className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-all hover:opacity-90 hover:shadow-md"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
                >
                  Get started
                </a>
              </div>
            }
          >
            {() => <HeaderUserMenu />}
          </ClientOnly>
        </div>
      )}
    </header>
  );
}
