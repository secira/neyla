import type { MetaFunction } from '@remix-run/cloudflare';
import { Header } from '~/components/header/Header';
import { Footer } from '~/components/layout/Footer';

export const meta: MetaFunction = () => [
  { title: 'Examples — Neyla' },
  { name: 'description', content: 'See what people are building with Neyla. Get inspired and start your own project.' },
];

const categories = ['All', 'Landing Page', 'SaaS', 'E-commerce', 'Dashboard', 'Portfolio', 'API'];

const examples = [
  {
    title: 'SaaS Dashboard',
    description: 'A full analytics dashboard with charts, user management, and dark mode — built in 8 minutes.',
    tags: ['SaaS', 'Dashboard'],
    stack: ['React', 'Tailwind', 'Recharts'],
    emoji: '📊',
    gradient: 'from-violet-500/10 to-purple-600/10',
    border: 'border-violet-200 dark:border-violet-900/40',
    accent: '#7C3AED',
    time: '8 min',
  },
  {
    title: 'E-commerce Storefront',
    description: 'A product listing page with cart, search, and Razorpay checkout — ready to launch.',
    tags: ['E-commerce'],
    stack: ['Next.js', 'Stripe', 'Prisma'],
    emoji: '🛍️',
    gradient: 'from-orange-500/10 to-pink-600/10',
    border: 'border-orange-200 dark:border-orange-900/40',
    accent: '#FF6B2B',
    time: '12 min',
  },
  {
    title: 'Developer Portfolio',
    description: 'A slick personal portfolio with project showcase, blog, and contact form.',
    tags: ['Portfolio'],
    stack: ['Astro', 'Tailwind'],
    emoji: '🎨',
    gradient: 'from-cyan-500/10 to-blue-600/10',
    border: 'border-cyan-200 dark:border-cyan-900/40',
    accent: '#0EA5E9',
    time: '5 min',
  },
  {
    title: 'SaaS Landing Page',
    description: 'A high-converting landing page with hero, features, pricing, and CTA sections.',
    tags: ['Landing Page', 'SaaS'],
    stack: ['React', 'Framer Motion'],
    emoji: '🚀',
    gradient: 'from-pink-500/10 to-rose-600/10',
    border: 'border-pink-200 dark:border-pink-900/40',
    accent: '#EC4899',
    time: '6 min',
  },
  {
    title: 'REST API Server',
    description: 'A Node.js Express API with authentication, rate limiting, and PostgreSQL — fully functional.',
    tags: ['API'],
    stack: ['Node.js', 'Express', 'PostgreSQL'],
    emoji: '⚡',
    gradient: 'from-green-500/10 to-teal-600/10',
    border: 'border-green-200 dark:border-green-900/40',
    accent: '#10B981',
    time: '10 min',
  },
  {
    title: 'Recipe App',
    description: 'A mobile-first recipe discovery app with search, filters, favourites, and a clean UI.',
    tags: ['Dashboard'],
    stack: ['React', 'Tailwind'],
    emoji: '🍜',
    gradient: 'from-amber-500/10 to-orange-600/10',
    border: 'border-amber-200 dark:border-amber-900/40',
    accent: '#F59E0B',
    time: '7 min',
  },
  {
    title: 'Kanban Board',
    description: 'A drag-and-drop project management board with columns, cards, and due dates.',
    tags: ['SaaS', 'Dashboard'],
    stack: ['React', 'DnD Kit'],
    emoji: '📋',
    gradient: 'from-indigo-500/10 to-blue-600/10',
    border: 'border-indigo-200 dark:border-indigo-900/40',
    accent: '#6366F1',
    time: '9 min',
  },
  {
    title: 'Blog Platform',
    description: 'A markdown-powered blog with syntax highlighting, tags, RSS feed, and SEO metadata.',
    tags: ['Landing Page'],
    stack: ['Astro', 'MDX'],
    emoji: '✍️',
    gradient: 'from-slate-500/10 to-gray-600/10',
    border: 'border-slate-200 dark:border-slate-800',
    accent: '#64748B',
    time: '11 min',
  },
  {
    title: 'Invoice Generator',
    description: 'Create, preview, and download PDF invoices. Includes GST/tax calculations.',
    tags: ['SaaS'],
    stack: ['React', 'PDF-lib'],
    emoji: '🧾',
    gradient: 'from-teal-500/10 to-cyan-600/10',
    border: 'border-teal-200 dark:border-teal-900/40',
    accent: '#14B8A6',
    time: '8 min',
  },
];

const prompts = [
  'Build a landing page for my AI startup with a waitlist form',
  'Create a expense tracker with charts and monthly budgets',
  'Make a multi-step onboarding flow with progress indicator',
  'Build a Notion-like text editor with rich formatting',
  'Create a real-time chat UI with message bubbles and timestamps',
  'Build a dark mode portfolio with animated hero section',
];

export default function ExamplesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <Header />

      <main className="flex-1">
        <section className="pt-24 pb-16 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-1.5 rounded-full mb-6">
              <span className="i-ph:sparkle-fill" />
              Inspiration gallery
            </span>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-5 leading-tight">
              See what you can{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                build today
              </span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed">
              Real projects, built with Neyla. Click any example to open it and start customising.
            </p>
          </div>
        </section>

        <section className="pb-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  cat === 'All'
                    ? 'text-white border-transparent'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-400 hover:text-orange-500'
                }`}
                style={cat === 'All' ? { background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {examples.map((ex) => (
              <div
                key={ex.title}
                className={`group rounded-2xl border ${ex.border} bg-gradient-to-br ${ex.gradient} p-6 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-white dark:bg-gray-900 shadow-sm"
                  >
                    {ex.emoji}
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded-full">
                    ~{ex.time}
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{ex.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{ex.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {ex.stack.map((s) => (
                      <span
                        key={s}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-900/70 text-gray-600 dark:text-gray-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <a
                    href="/"
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full text-white transition-all hover:opacity-90 flex-shrink-0 ml-2"
                    style={{ background: `${ex.accent}` }}
                  >
                    Open
                    <span className="i-ph:arrow-right-bold" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
              Or start with a prompt
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-10">
              Click any prompt below to instantly start a new project
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-3xl mx-auto">
              {prompts.map((p) => (
                <a
                  key={p}
                  href={`/?q=${encodeURIComponent(p)}`}
                  className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-orange-400 hover:shadow-md transition-all"
                >
                  <span className="i-ph:chat-dots-duotone text-orange-400 text-lg flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-orange-500 transition-colors">
                    {p}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-5">
              Your idea is next
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Free to start. No credit card. No setup. Just build.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-bold text-base transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              <span className="i-ph:rocket-launch-fill" />
              Start building now
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
