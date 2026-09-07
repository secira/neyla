import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { HeaderUserMenu } from './HeaderUserMenu.client';
import { toggleSidebar } from '~/lib/stores/sidebar';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';

export function Header() {
  const chat = useStore(chatStore);
  const openWorkbenchView = (view: WorkbenchViewType) => {
    workbenchStore.showWorkbench.set(true);
    workbenchStore.currentView.set(view);
  };

  return (
    <header
      className={classNames(
        'flex items-center border-b z-50',
        {
          'h-[var(--header-height)] px-4 sm:px-6 border-transparent backdrop-blur-sm bg-white/80 dark:bg-gray-950/80': !chat.started,
          'h-11 px-3 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo">
          <button
          onClick={toggleSidebar}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white"
          aria-label="Toggle project history"
          title="My Projects"
        >
            <div className="i-ph:sidebar-simple text-lg" />
        </button>
        <a href="/" className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <span
              className={chat.started ? 'text-base font-extrabold tracking-tight' : 'text-2xl font-black tracking-tight'}
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Neyla
            </span>
            <span className="mb-0.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-1 py-0.5 text-[8px] font-semibold leading-none text-white">
              beta
            </span>
          </div>
        </a>
      </div>

      {chat.started && (
        <>
          <div className="ml-5 hidden items-center gap-1 text-[11px] text-slate-500 lg:flex">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded px-2 py-1 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white"
              title="Open workspace tools"
            >
              Tools
            </button>
            <button
              type="button"
              onClick={() => openWorkbenchView('preview')}
              className="rounded px-2 py-1 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => openWorkbenchView('code')}
              className="rounded px-2 py-1 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              Code
            </button>
          </div>
          <span className="min-w-0 flex-1 truncate px-3 text-center text-xs font-medium text-slate-700 dark:text-slate-200">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            <span className="ml-1 inline-block align-middle text-[11px] text-slate-400">✎</span>
          </span>
          <ClientOnly>
            {() => (
              <div className="flex items-center gap-2">
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
