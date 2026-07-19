import type { MetaFunction } from '@remix-run/cloudflare';
import { Header } from '~/components/header/Header';
import { Footer } from '~/components/layout/Footer';

export const meta: MetaFunction = () => [
  { title: 'Community — Neyla' },
  { name: 'description', content: 'Join the Neyla community — share what you build, get help, and connect with fellow builders.' },
];

const stats = [
  { label: 'Community members', value: '12,000+', icon: 'i-ph:users-three-duotone' },
  { label: 'Projects created', value: '85,000+', icon: 'i-ph:folders-duotone' },
  { label: 'GitHub stars', value: '4,200+', icon: 'i-ph:star-duotone' },
  { label: 'Discord messages/day', value: '2,500+', icon: 'i-ph:chat-circle-dots-duotone' },
];

const channels = [
  {
    icon: 'i-ph:discord-logo-fill',
    name: 'Discord',
    description: 'Our most active community hub. Share builds, get live help, and connect with thousands of builders.',
    cta: 'Join Discord',
    href: 'https://discord.com',
    gradient: 'from-indigo-500 to-purple-600',
    color: '#5865F2',
  },
  {
    icon: 'i-ph:github-logo-fill',
    name: 'GitHub',
    description: 'Neyla is open source. Star the repo, file issues, submit PRs, and help shape the product.',
    cta: 'View on GitHub',
    href: 'https://github.com',
    gradient: 'from-gray-700 to-gray-900',
    color: '#24292E',
  },
  {
    icon: 'i-ph:twitter-logo-fill',
    name: 'Twitter / X',
    description: 'Follow for product updates, builder spotlights, and AI tips. Tag us in your builds!',
    cta: 'Follow @NeylaAI',
    href: 'https://twitter.com',
    gradient: 'from-sky-500 to-blue-600',
    color: '#1DA1F2',
  },
];

const showcaseItems = [
  {
    author: 'Arjun M.',
    location: 'Bangalore',
    project: 'Inventory Management SaaS',
    description: 'Built a full SaaS for a local textile business in 2 days. Now charging ₹5,000/month per client.',
    emoji: '📦',
    gradient: 'from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10',
    border: 'border-orange-200 dark:border-orange-900/30',
  },
  {
    author: 'Priya S.',
    location: 'Chennai',
    project: 'Freelance Portfolio',
    description: "Landed 3 new clients in the first week after launching my portfolio. Took 20 minutes to build.",
    emoji: '🎨',
    gradient: 'from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10',
    border: 'border-pink-200 dark:border-pink-900/30',
  },
  {
    author: 'Rohan K.',
    location: 'Pune',
    project: 'Booking System',
    description: 'Replaced a ₹30k/yr Calendly subscription with a custom booking system built in an afternoon.',
    emoji: '📅',
    gradient: 'from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10',
    border: 'border-cyan-200 dark:border-cyan-900/30',
  },
  {
    author: 'Meera N.',
    location: 'Hyderabad',
    project: 'EdTech Dashboard',
    description: 'Built a student progress tracker for my coaching centre. Parents love the real-time updates.',
    emoji: '📚',
    gradient: 'from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10',
    border: 'border-violet-200 dark:border-violet-900/30',
  },
  {
    author: 'Karan T.',
    location: 'Mumbai',
    project: 'Restaurant Menu App',
    description: 'A QR-code menu app for my uncle\'s restaurant. Cut printing costs by ₹8,000/year.',
    emoji: '🍽️',
    gradient: 'from-green-50 to-teal-50 dark:from-green-900/10 dark:to-teal-900/10',
    border: 'border-green-200 dark:border-green-900/30',
  },
  {
    author: 'Ananya R.',
    location: 'Delhi',
    project: 'Expense Tracker',
    description: 'Built a family expense tracker with monthly budgets and charts. All of us use it every day.',
    emoji: '💰',
    gradient: 'from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10',
    border: 'border-amber-200 dark:border-amber-900/30',
  },
];

const faqs = [
  {
    q: 'Is Neyla open source?',
    a: 'Yes! The core Neyla platform is open source and available on GitHub. We welcome contributions, bug reports, and feature requests from the community.',
  },
  {
    q: 'Where can I ask for help?',
    a: 'Discord is the best place for real-time help. We have dedicated channels for troubleshooting, sharing projects, and general chat. Our team is active daily.',
  },
  {
    q: 'Can I showcase my project?',
    a: 'Absolutely. Share your project in the #showcase channel on Discord. We feature the best builds in our weekly newsletter and on our social media.',
  },
  {
    q: 'How do I report a bug?',
    a: "Open a GitHub issue with a description and steps to reproduce. For urgent problems, ping us in the #bugs channel on Discord and we'll respond within 24 hours.",
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <Header />

      <main className="flex-1">
        <section className="pt-24 pb-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-1.5 rounded-full mb-6">
              <span className="i-ph:heart-fill" />
              Built together
            </span>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              A community of{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                makers & builders
              </span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed">
              Join thousands of developers, designers, and founders who are building the next generation of software with AI.
            </p>
          </div>
        </section>

        <section className="pb-20 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center"
              >
                <span className={`${s.icon} text-3xl text-orange-400 block mb-3`} />
                <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Join the conversation</h2>
              <p className="text-gray-500 dark:text-gray-400">We're wherever you are</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {channels.map((c) => (
                <div
                  key={c.name}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col gap-4"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center`}
                  >
                    <span className={`${c.icon} text-2xl text-white`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{c.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{c.description}</p>
                  </div>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: c.color }}
                  >
                    {c.cta}
                    <span className="i-ph:arrow-right-bold" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
                Built by our community
              </h2>
              <p className="text-gray-500 dark:text-gray-400">Real projects, real people, real results</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {showcaseItems.map((item) => (
                <div
                  key={item.project}
                  className={`rounded-2xl border ${item.border} bg-gradient-to-br ${item.gradient} p-6`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center text-xl shadow-sm">
                      {item.emoji}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{item.author}</div>
                      <div className="text-xs text-gray-500">{item.location}</div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{item.project}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-10 text-center">
              Frequently asked
            </h2>
            <div className="flex flex-col gap-4">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
                >
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center mx-auto mb-6">
              <span className="i-ph:discord-logo-fill text-3xl text-white" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
              We'd love to have you
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Join our Discord — introduce yourself, share what you're building, and meet the team.
            </p>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-bold text-base transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              <span className="i-ph:discord-logo-fill" />
              Join our Discord
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
