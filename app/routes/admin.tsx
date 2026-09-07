import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { authLoadingAtom, authUserAtom, fetchCurrentUser } from '~/lib/stores/auth';

type Tab = 'overview' | 'users' | 'companies' | 'billing' | 'secrets';

type Overview = {
  counts: { users: number; organizations: number; projects: number };
  billing: { activeSubscriptions: number; paidInvoices: number; revenue: number; currency: string };
  providerSecrets: Array<{ id: string; provider: string; key_name: string; secret_hint: string; enabled: boolean }>;
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  global_role: string;
  created_at: string;
  organization_count: number;
  project_count: number;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_at: string;
  member_count: number;
  project_count: number;
  subscription_plan: string | null;
  subscription_status: string | null;
};

type BillingRow = {
  id: string;
  owner_email: string;
  organization_name: string | null;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  current_period_end: string;
  source: 'organization' | 'user';
};

type GlobalSecret = Overview['providerSecrets'][number] & { updated_at: string };

const inputClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-orange-500';

async function adminFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`/api/admin/${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(new Error(payload.error || 'Admin request failed'), { status: response.status });
  }

  return payload;
}

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((amount || 0) / 100);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function AdminPage() {
  const navigate = useNavigate();
  const user = useStore(authUserAtom);
  const authLoading = useStore(authLoadingAtom);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [secrets, setSecrets] = useState<GlobalSecret[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [secretProvider, setSecretProvider] = useState('');
  const [secretKeyName, setSecretKeyName] = useState('');
  const [secretValue, setSecretValue] = useState('');

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, navigate, user]);

  async function loadOverview() {
    setLoading(true);
    try {
      const payload = await adminFetch('overview');
      setOverview(payload);
      setAccessError('');
    } catch (loadError: any) {
      if (loadError.status === 401) {
        navigate('/login');
      } else if (loadError.status === 403) {
        setAccessError('This area is restricted to Neyla platform administrators.');
      } else {
        setAccessError(loadError.message || 'Unable to load admin data');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadOverview();
    }
  }, [user]);

  useEffect(() => {
    if (!overview || tab === 'overview') {
      return;
    }

    setError('');
    const loadTab = async () => {
      try {
        if (tab === 'users') {
          const payload = await adminFetch(`users?search=${encodeURIComponent(search)}`);
          setUsers(payload.users || []);
        } else if (tab === 'companies') {
          const payload = await adminFetch('organizations');
          setOrganizations(payload.organizations || []);
        } else if (tab === 'billing') {
          const payload = await adminFetch('billing');
          setBilling(payload.billing || []);
        } else if (tab === 'secrets') {
          const payload = await adminFetch('secrets');
          setSecrets(payload.secrets || []);
        }
      } catch (loadError: any) {
        setError(loadError.message || 'Unable to load this section');
      }
    };

    loadTab();
  }, [overview, search, tab]);

  async function updateRole(target: AdminUser, role: string) {
    try {
      await adminFetch(`users/${target.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, global_role: role } : item)));
      setNotice(`${target.email} is now ${role === 'platform_admin' ? 'a platform admin' : 'a standard user'}.`);
    } catch (updateError: any) {
      setError(updateError.message || 'Unable to update role');
    }
  }

  async function saveGlobalSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await adminFetch('secrets', {
        method: 'POST',
        body: JSON.stringify({ provider: secretProvider, key_name: secretKeyName, value: secretValue }),
      });
      setSecretProvider('');
      setSecretKeyName('');
      setSecretValue('');
      setNotice('Global secret encrypted and saved. Its value is never returned to the browser.');
      const payload = await adminFetch('secrets');
      setSecrets(payload.secrets || []);
      await loadOverview();
    } catch (saveError: any) {
      setError(saveError.message || 'Unable to save global secret');
    }
  }

  async function deleteGlobalSecret(secret: GlobalSecret) {
    if (!window.confirm(`Delete ${secret.key_name} for ${secret.provider}?`)) {
      return;
    }

    try {
      await adminFetch(`secrets/${secret.id}`, { method: 'DELETE' });
      setSecrets((current) => current.filter((item) => item.id !== secret.id));
      setNotice(`${secret.key_name} was deleted.`);
      await loadOverview();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Unable to delete global secret');
    }
  }

  const tabs = useMemo(
    () =>
      [
        ['overview', 'Overview', 'i-ph:squares-four'],
        ['users', 'Users', 'i-ph:users-three'],
        ['companies', 'Companies', 'i-ph:buildings'],
        ['billing', 'Billing', 'i-ph:credit-card'],
        ['secrets', 'AI secrets', 'i-ph:keyhole'],
      ] as Array<[Tab, string, string]>,
    [],
  );

  if (authLoading || (!user && !accessError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfc] dark:bg-gray-950">
        <div className="i-svg-spinners:ring-resize text-3xl text-orange-500" />
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfc] px-4 dark:bg-gray-950">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="i-ph:shield-warning mx-auto mb-4 text-4xl text-orange-500" />
          <h1 className="text-xl font-black">Admin access required</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{accessError}</p>
          <Link to="/projects" className="mt-6 inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-gray-900">
            Return to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f9] text-gray-900 dark:bg-gray-950 dark:text-white">
      <header className="flex h-16 items-center border-b border-gray-200 bg-white px-5 dark:border-gray-800 dark:bg-gray-950">
        <Link to="/projects" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-[#ff477e]">Neyla</span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300">
            Admin
          </span>
        </Link>
        <div className="flex-1" />
        <span className="hidden text-sm text-gray-500 sm:block">{user?.email}</span>
        <Link to="/projects" className="ml-4 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900">
          Exit admin
        </Link>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="w-full shrink-0 lg:w-56">
          <div className="mb-5 px-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Control plane</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage Neyla globally</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {tabs.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${
                  tab === id
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white'
                }`}
              >
                <div className={`${icon} text-lg`} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-500">Platform administration</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">
                {tabs.find(([id]) => id === tab)?.[1]}
              </h1>
            </div>
            {tab === 'users' ? (
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users…"
                className={`${inputClass} w-full sm:w-64`}
              />
            ) : null}
          </div>

          {notice ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div> : null}
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}

          {loading || !overview ? (
            <div className="flex justify-center py-24">
              <div className="i-svg-spinners:ring-resize text-3xl text-orange-500" />
            </div>
          ) : tab === 'overview' ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ['Users', overview.counts.users, 'i-ph:users-three', 'Accounts with access to Neyla'],
                  ['Companies', overview.counts.organizations, 'i-ph:buildings', 'Personal and team organizations'],
                  ['Projects', overview.counts.projects, 'i-ph:browser', 'Apps being created and deployed'],
                ].map(([label, value, icon, caption]) => (
                  <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</span>
                      <div className={`${icon} text-xl text-orange-500`} />
                    </div>
                    <p className="text-3xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{caption}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold">Payments</h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Organization and user subscriptions</p>
                    </div>
                    <div className="i-ph:trend-up text-xl text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black">{formatMoney(overview.billing.revenue, overview.billing.currency)}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {overview.billing.paidInvoices} paid invoices · {overview.billing.activeSubscriptions} active subscriptions
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold">AI provider coverage</h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Global keys managed in the encrypted vault</p>
                    </div>
                    <div className="i-ph:keyhole text-xl text-purple-500" />
                  </div>
                  <p className="text-3xl font-black">{overview.providerSecrets.length}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Provider keys configured for the platform</p>
                </div>
              </div>
            </div>
          ) : tab === 'users' ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                    <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Companies</th><th className="px-5 py-3">Projects</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Joined</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4"><p className="font-semibold">{item.name || 'Unnamed user'}</p><p className="mt-0.5 text-xs text-gray-500">{item.email}</p></td>
                        <td className="px-5 py-4 text-gray-500">{item.organization_count}</td>
                        <td className="px-5 py-4 text-gray-500">{item.project_count}</td>
                        <td className="px-5 py-4">
                          <select value={item.global_role} onChange={(event) => updateRole(item, event.target.value)} className={`${inputClass} py-1.5 text-xs`}>
                            <option value="user">User</option>
                            <option value="platform_admin">Platform admin</option>
                          </select>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!users.length ? <p className="px-5 py-12 text-center text-sm text-gray-500">No users found.</p> : null}
            </div>
          ) : tab === 'companies' ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                    <tr><th className="px-5 py-3">Company</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Projects</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Created</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {organizations.map((organization) => (
                      <tr key={organization.id}>
                        <td className="px-5 py-4"><p className="font-semibold">{organization.name}</p><p className="mt-0.5 text-xs text-gray-500">{organization.is_personal ? 'Personal workspace' : organization.slug}</p></td>
                        <td className="px-5 py-4 text-gray-500">{organization.member_count}</td>
                        <td className="px-5 py-4 text-gray-500">{organization.project_count}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{organization.subscription_plan || 'Free'}</span></td>
                        <td className="px-5 py-4 text-xs text-gray-500">{formatDate(organization.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'billing' ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                    <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Renews</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {billing.map((item) => (
                      <tr key={`${item.source}-${item.id}`}>
                        <td className="px-5 py-4 font-semibold">{item.owner_email}</td>
                        <td className="px-5 py-4 text-gray-500">{item.organization_name || 'Personal account'}</td>
                        <td className="px-5 py-4 capitalize">{item.plan}</td>
                        <td className="px-5 py-4">{formatMoney(item.amount, item.currency)}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold capitalize text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{item.status}</span></td>
                        <td className="px-5 py-4 text-gray-500">{formatDate(item.current_period_end)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!billing.length ? <p className="px-5 py-12 text-center text-sm text-gray-500">No subscriptions yet.</p> : null}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
              <form onSubmit={saveGlobalSecret} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="font-bold">Add or rotate a global AI key</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Global keys power shared provider access. Values are encrypted before storage and are never returned.</p>
                <div className="mt-5 space-y-3">
                  <input required value={secretProvider} onChange={(event) => setSecretProvider(event.target.value)} placeholder="Provider, e.g. OpenAI" className={`${inputClass} w-full`} />
                  <input required value={secretKeyName} onChange={(event) => setSecretKeyName(event.target.value)} placeholder="Key name, e.g. OPENAI_API_KEY" className={`${inputClass} w-full`} />
                  <input required type="password" value={secretValue} onChange={(event) => setSecretValue(event.target.value)} placeholder="Secret value" className={`${inputClass} w-full`} />
                  <button type="submit" className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 dark:bg-white dark:text-gray-900">Save encrypted key</button>
                </div>
              </form>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="font-bold">Configured global keys</h2>
                <div className="mt-4 space-y-3">
                  {secrets.map((secret) => (
                    <div key={secret.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                      <div className="i-ph:keyhole text-xl text-purple-500" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{secret.key_name}</p><p className="mt-0.5 text-xs text-gray-500">{secret.provider} · {secret.secret_hint}</p></div>
                      <button type="button" onClick={() => deleteGlobalSecret(secret)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" title="Delete key"><div className="i-ph:trash" /></button>
                    </div>
                  ))}
                  {!secrets.length ? <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-800">No global database-managed keys yet.</p> : null}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}