const railItems = [
  { href: '/projects', icon: 'i-ph:stack-simple', label: 'Projects' },
  { href: '/', icon: 'i-ph:plus-circle', label: 'New build' },
  { href: '/examples', icon: 'i-ph:sparkle', label: 'Examples' },
  { href: '/community', icon: 'i-ph:users-three', label: 'Community' },
];

export function BuilderRail() {
  return (
    <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-slate-200 bg-slate-50 py-2 text-slate-500 dark:border-slate-800 dark:bg-slate-950 md:flex">
      <a
        href="/"
        aria-label="Neyla home"
        className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-sm font-black text-white shadow-sm"
      >
        N
      </a>

      <nav className="flex flex-col items-center gap-1" aria-label="Workspace navigation">
        {railItems.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className={[
              'flex h-8 w-8 items-center justify-center rounded-md text-[17px] transition-colors',
              index === 0
                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700'
                : 'hover:bg-white hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100',
            ].join(' ')}
          >
            <span className={item.icon} />
          </a>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <a
          href="/pricing"
          aria-label="Plans"
          title="Plans"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[17px] text-slate-500 transition-colors hover:bg-white hover:text-orange-500 dark:hover:bg-slate-900"
        >
          <span className="i-ph:lightning" />
        </a>
        <a
          href="/projects"
          aria-label="Settings and projects"
          title="Settings and projects"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[17px] text-slate-500 transition-colors hover:bg-white hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          <span className="i-ph:gear-six" />
        </a>
      </div>
    </aside>
  );
}