export function Footer() {
  const currentYear = new Date().getFullYear();

  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Examples', href: '/examples' },
        { label: 'Changelog', href: '#' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'Community', href: '/community' },
        { label: 'GitHub', href: 'https://github.com', external: true },
        { label: 'Blog', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Press', href: '#' },
        { label: 'Contact', href: 'mailto:hello@skech.ai' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '#' },
        { label: 'Terms of Service', href: '#' },
        { label: 'Cookie Policy', href: '#' },
        { label: 'Security', href: '#' },
      ],
    },
  ];

  const socials = [
    { icon: 'i-ph:twitter-logo-fill', href: 'https://twitter.com', label: 'Twitter' },
    { icon: 'i-ph:github-logo-fill', href: 'https://github.com', label: 'GitHub' },
    { icon: 'i-ph:discord-logo-fill', href: 'https://discord.com', label: 'Discord' },
    { icon: 'i-ph:linkedin-logo-fill', href: 'https://linkedin.com', label: 'LinkedIn' },
  ];

  return (
    <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          <div className="lg:col-span-2 flex flex-col gap-5">
            <a href="/" className="flex items-center gap-1.5 w-fit">
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
            </a>

            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
              Build websites and SaaS apps with AI — describe what you want, and Skech builds it instantly.
            </p>

            <div className="flex items-center gap-3 mt-1">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-500 transition-all"
                >
                  <span className={`${s.icon} text-base`} />
                </a>
              ))}
            </div>

            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Stay in the loop</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
                />
                <button
                  className="text-sm font-semibold px-3 py-2 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            © {currentYear} Skech. All rights reserved. Made with ❤️ in India.
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
