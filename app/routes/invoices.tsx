import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { authUserAtom, fetchCurrentUser } from '~/lib/stores/auth';
import { Header } from '~/components/header/Header';
import { Footer } from '~/components/layout/Footer';

interface Invoice {
  id: string;
  invoice_number: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  razorpay_payment_id: string | null;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

function formatAmount(amount: number, currency: string) {
  const dollars = amount / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(dollars);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function InvoicesPage() {
  const user = useStore(authUserAtom);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetch('/api/payments/invoices', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          setInvoices(d.invoices || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (user === null) {
      setLoading(false);
    }
  }, [user]);

  if (!user && !loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="i-ph:lock-simple-fill text-5xl text-gray-300 dark:text-gray-700 mb-4 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sign in to view invoices</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">You need an account to access your billing history.</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
          >
            Sign in
          </a>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Invoices</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your billing and payment history</p>
          </div>
          <a
            href="/pricing"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-orange-400 transition-colors"
          >
            <div className="i-ph:crown text-orange-500" />
            Upgrade plan
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="i-svg-spinners:ring-resize text-3xl text-orange-500" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <div className="i-ph:receipt text-5xl text-gray-200 dark:text-gray-800 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No invoices yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Subscribe to a plan to see your invoices here.
            </p>
            <a
              href="/pricing"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              View plans
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div>Invoice</div>
              <div>Plan</div>
              <div>Amount</div>
              <div>Date</div>
              <div>Status</div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 items-center hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div>
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                      {invoice.invoice_number}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{invoice.plan}</span>
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(invoice.issued_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : invoice.status === 'pending'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-500'
                            : invoice.status === 'pending'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      {invoice.status}
                    </span>

                    {invoice.razorpay_payment_id && (
                      <button
                        onClick={() => {
                          const content = [
                            'INVOICE',
                            '='.repeat(40),
                            `Invoice No:  ${invoice.invoice_number}`,
                            `Date:        ${formatDate(invoice.issued_at)}`,
                            ``,
                            `Bill To:`,
                            `  ${user?.name || user?.email}`,
                            `  ${user?.email}`,
                            ``,
                            `Description: Neyla ${invoice.plan.charAt(0).toUpperCase() + invoice.plan.slice(1)} Plan`,
                            `Amount:      ${formatAmount(invoice.amount, invoice.currency)}`,
                            `Status:      ${invoice.status.toUpperCase()}`,
                            `Payment ID:  ${invoice.razorpay_payment_id}`,
                            ``,
                            'Thank you for using Neyla!',
                          ].join('\n');

                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${invoice.invoice_number}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
                      >
                        <div className="i-ph:download-simple text-sm" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Need help with billing? Email us at{' '}
            <a href="mailto:billing@neyla.dev" className="text-orange-500 hover:underline">
              billing@neyla.dev
            </a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
