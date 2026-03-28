import type { MetaFunction } from '@remix-run/cloudflare';
import { Header } from '~/components/header/Header';
import { Footer } from '~/components/layout/Footer';

export const meta: MetaFunction = () => [
  { title: 'Features — Skech' },
  { name: 'description', content: 'Everything you need to build full-stack apps and websites with AI — instantly.' },
];

const features = [
  {
    icon: 'i-ph:brain-duotone',
    gradient: 'from-violet-500 to-purple-600',
    title: 'AI-Powered Code Generation',
    description:
      'Describe what you want in plain English. Skech generates production-quality code across React, Next.js, Vue, Svelte, and more — instantly.',
    bullets: ['Natural language to code', 'Context-aware edits', 'Multi-file projects'],
  },
  {
    icon: 'i-ph:robot-duotone',
    gradient: 'from-orange-500 to-pink-500',
    title: '22+ AI Providers',
    description:
      'Use Claude, GPT-4, Gemini, Llama, Mistral, Groq, and 20+ other frontier models. Switch at any time with a single click.',
    bullets: ['Anthropic, OpenAI, Google', 'Open-source models via Ollama', 'OpenRouter access to 300+ models'],
  },
  {
    icon: 'i-ph:monitor-play-duotone',
    gradient: 'from-cyan-500 to-blue-600',
    title: 'Live Preview & Hot Reload',
    description:
      "See your app running in real-time as AI writes it. No build steps, no waiting — your app boots in seconds inside an in-browser sandbox.",
    bullets: ['Instant preview', 'Terminal access', 'Full Node.js environment'],
  },
  {
    icon: 'i-ph:git-branch-duotone',
    gradient: 'from-green-500 to-teal-600',
    title: 'GitHub Integration',
    description:
      'Push your project directly to GitHub with one click. Import existing repos, create new ones, and stay in sync with your codebase.',
    bullets: ['Push to GitHub', 'Import existing repos', 'Branch management'],
  },
  {
    icon: 'i-ph:stack-duotone',
    gradient: 'from-amber-500 to-orange-600',
    title: 'Smart File Management',
    description:
      'A full file system explorer lets you browse, edit, create, and delete files. Lock files to prevent AI from overwriting your custom changes.',
    bullets: ['File system explorer', 'Lock files from AI', 'Inline code editor'],
  },
  {
    icon: 'i-ph:rocket-launch-duotone',
    gradient: 'from-pink-500 to-rose-600',
    title: 'One-Click Deploy',
    description:
      'Deploy to Vercel, Netlify, or GitHub Pages with a single click. From idea to production URL in under a minute.',
    bullets: ['Vercel & Netlify deploy', 'Static site hosting', 'Custom domain support'],
  },
  {
    icon: 'i-ph:users-three-duotone',
    gradient: 'from-indigo-500 to-blue-600',
    title: 'Team Workspaces',
    description:
      'Collaborate with your team in shared workspaces. Invite members, share projects, and build together — billed as one.',
    bullets: ['Shared workspaces', 'Up to 10 team members', 'Team billing & invoices'],
  },
  {
    icon: 'i-ph:shield-check-duotone',
    gradient: 'from-emerald-500 to-green-600',
    title: 'Secure & Private',
    description:
      'Your code stays yours. All projects are private by default. Enterprise-grade security with SOC 2 compliance in progress.',
    bullets: ['Private by default', 'Encrypted storage', 'SOC 2 in progress'],
  },
];

const models = [
  { name: 'Claude 3.5', provider: 'Anthropic', color: '#D97757' },
  { name: 'GPT-4o', provider: 'OpenAI', color: '#10A37F' },
  { name: 'Gemini 1.5', provider: 'Google', color: '#4285F4' },
  { name: 'Llama 3.3', provider: 'Meta', color: '#0668E1' },
  { name: 'Mistral Large', provider: 'Mistral', color: '#FF7000' },
  { name: 'Deepseek V3', provider: 'Deepseek', color: '#6366F1' },
  { name: 'Groq Llama', provider: 'Groq', color: '#F55036' },
  { name: '300+ more', provider: 'OpenRouter', color: '#7C3AED' },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <Header />

      <main className="flex-1">
        <section className="pt-24 pb-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-1.5 rounded-full mb-6">
              <span className="i-ph:lightning-fill" />
              Everything you need
            </span>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              Build faster with{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                AI at the core
              </span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
              From a blank canvas to a deployed app — Skech handles the heavy lifting so you can focus on what matters.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-bold text-base transition-all hover:opacity-90 hover:shadow-lg hover:shadow-orange-200"
                style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
              >
                <span className="i-ph:rocket-launch-fill" />
                Start building free
              </a>
              <a
                href="/examples"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-base hover:border-orange-400 hover:text-orange-500 transition-all"
              >
                <span className="i-ph:play-circle-fill" />
                See examples
              </a>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">
              Choose from 22+ AI providers
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {models.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: m.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.provider}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 transition-all"
                >
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4`}
                  >
                    <span className={`${f.icon} text-xl text-white`} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{f.description}</p>
                  <ul className="flex flex-col gap-1.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="i-ph:check-circle-fill text-green-500 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-gray-950 dark:bg-black text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-5">
              Ready to ship{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                10× faster?
              </span>
            </h2>
            <p className="text-gray-400 text-lg mb-10">
              Join thousands of builders already using Skech to turn ideas into products.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-bold text-base transition-all hover:opacity-90 hover:shadow-lg hover:shadow-orange-500/25"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              <span className="i-ph:rocket-launch-fill" />
              Start for free — no credit card needed
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
