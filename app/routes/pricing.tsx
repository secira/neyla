import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { authUserAtom, fetchCurrentUser } from '~/lib/stores/auth';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  {
    id: 'individual',
    name: 'Individual',
    price: '$20',
    period: '/month',
    description: 'Perfect for solo developers and freelancers building with AI.',
    features: [
      'Unlimited AI-powered projects',
      'All 22+ AI providers',
      'GitHub integration',
      'Project history & snapshots',
      'Priority support',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    id: 'teams',
    name: 'Teams',
    price: '$100',
    period: '/month',
    description: 'For teams that build together and ship faster.',
    features: [
      'Everything in Individual',
      'Up to 10 team members',
      'Shared workspaces',
      'Team billing & invoices',
      'Dedicated onboarding',
      'SLA support',
    ],
    cta: 'Start team trial',
    highlight: true,
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  const user = useStore(authUserAtom);
  const [loading, setLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetch('/api/payments/subscription', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setSubscription(d.subscription))
        .catch(() => {});
    }
  }, [user]);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleSubscribe(planId: string) {
    if (!user) {
      window.location.href = `/signup?redirect=/pricing`;
      return;
    }

    setLoading(planId);

    try {
      const loaded = await loadRazorpayScript();

      if (!loaded) {
        showToast('Failed to load payment system. Please try again.', 'error');
        setLoading(null);
        return;
      }

      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: planId }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        showToast(orderData.error || 'Failed to create order', 'error');
        setLoading(null);
        return;
      }

      const plan = PLANS.find((p) => p.id === planId)!;

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Skech',
        description: `${plan.name} Plan — ${plan.price}/month`,
        image: '/logo.png',
        order_id: orderData.order_id,
        prefill: {
          email: user.email,
          name: user.name || user.email,
        },
        theme: {
          color: '#FF6B2B',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              showToast(`Successfully subscribed to ${plan.name} plan!`, 'success');

              const subRes = await fetch('/api/payments/subscription', { credentials: 'include' });
              const subData = await subRes.json();
              setSubscription(subData.subscription);
            } else {
              showToast(verifyData.error || 'Payment verification failed', 'error');
            }
          } catch {
            showToast('Payment verification failed. Please contact support.', 'error');
          }

          setLoading(null);
        },
        modal: {
          ondismiss: () => setLoading(null),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showToast('Something went wrong. Please try again.', 'error');
      setLoading(null);
    }
  }

  const currentPlan = subscription?.plan;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-4">
            Simple,{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              honest pricing
            </span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Build unlimited AI-powered apps. Pay once a month. Cancel any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 border-2 border-orange-300 dark:border-orange-600 shadow-xl'
                    : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold text-white px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-pink-500">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      <div className="i-ph:check-circle-fill text-green-500 text-lg flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="w-full py-3 rounded-xl text-sm font-semibold text-center text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                    <div className="i-ph:check-circle-fill inline mr-1.5" />
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isLoading}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                      plan.highlight
                        ? 'text-white hover:opacity-90 hover:shadow-lg disabled:opacity-60'
                        : 'text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 disabled:opacity-50'
                    }`}
                    style={
                      plan.highlight
                        ? { background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }
                        : undefined
                    }
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="i-svg-spinners:ring-resize text-lg" />
                        Processing…
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Payments are secured by{' '}
            <span className="font-semibold text-gray-600 dark:text-gray-400">Razorpay</span>. All major cards,
            UPI, net banking accepted.
          </p>
          {user && (
            <a
              href="/invoices"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              <div className="i-ph:receipt text-base" />
              View your invoices
            </a>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-center">
          {[
            { icon: 'i-ph:shield-check-fill', title: 'Secure payments', desc: 'All transactions encrypted & protected by Razorpay' },
            { icon: 'i-ph:arrow-counter-clockwise', title: 'Cancel anytime', desc: 'No lock-in. Downgrade or cancel with one click' },
            { icon: 'i-ph:headset', title: 'Dedicated support', desc: 'We respond to paid users within 24 hours' },
          ].map((item) => (
            <div key={item.title} className="p-5">
              <div className={`${item.icon} text-2xl text-orange-500 mb-2 mx-auto`} />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
