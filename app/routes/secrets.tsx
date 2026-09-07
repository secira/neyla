import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { authLoadingAtom, authUserAtom, fetchCurrentUser } from '~/lib/stores/auth';

type UserSecret = {
  id: string;
  provider: string;
  key_name: string;
  hint: string;
  enabled: boolean;
  updated_at: string;
};

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-orange-500 dark:focus:ring-orange-950';

export default function SecretsPage() {
  const navigate = useNavigate();
  const user = useStore(authUserAtom);
  const authLoading = useStore(authLoadingAtom);
  const [secrets, setSecrets] = useState<UserSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [provider, setProvider] = useState('');
  const [keyName, setKeyName] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, navigate, user]);

  async function loadSecrets() {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/secrets', { credentials: 'include' });
      const payload: any = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load your secrets');
      }

      setSecrets(payload.secrets || []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your secrets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadSecrets();
    }
  }, [user]);

  async function saveSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/auth/secrets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key_name: keyName, value }),
      });
      const payload: any = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save secret');
      }

      setProvider('');
      setKeyName('');
      setValue('');
      setNotice('Secret saved securely. The value will not be shown again.');
      await loadSecrets();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save secret');
    } finally {
      setSaving(false);
    }
  }

  async function removeSecret(secret: UserSecret) {
    if (!window.confirm(`Delete ${secret.key_name} for ${secret.provider}?`)) {
      return;
    }

    const response = await fetch(`/api/auth/secrets/${secret.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.ok) {
      setNotice(`${secret.key_name} was deleted.`);
      await loadSecrets();
    } else {
      const payload: any = await response.json().catch(() => ({}));
      setError(payload.error || 'Unable to delete secret');
    }
  }

  if (authLoading || (!user && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="i-svg-spinners:ring-resize text-3xl text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfc] text-gray-900 dark:bg-gray-950 dark:text-white">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-5 dark:border-gray-800 dark:bg-gray-950">
        <Link to="/projects" className="flex items-center gap-2 font-black tracking-tight">
          <span className="text-xl text-[#ff477e]">Neyla</span>
          <span className="text-xs font-medium text-gray-400">/ My secrets</span>
        </Link>
        <div className="flex-1" />
        <Link
          to="/projects"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          Back to projects
        </Link>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.05fr_1.4fr]">
        <section>
          <div className="mb-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <div className="i-ph:keyhole text-xl" />
            </div>
            <h1 className="text-2xl font-black">Your API secrets</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Add provider keys for your own projects. Neyla encrypts these values on the server and only shows
              a safe hint after saving.
            </p>
          </div>

          <form
            onSubmit={saveSecret}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4">
              <h2 className="font-bold">Add or rotate a secret</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Saving the same provider and key name replaces the encrypted value.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Provider
                <input
                  required
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  placeholder="OpenAI, Anthropic, GitHub…"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Key name
                <input
                  required
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="OPENAI_API_KEY"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Secret value
                <input
                  required
                  type="password"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Paste the value once"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-[#ff6b2b] to-[#ff3cac] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? 'Encrypting…' : 'Save encrypted secret'}
              </button>
            </div>
          </form>

          {notice ? <p className="mt-4 text-sm font-medium text-emerald-600">{notice}</p> : null}
          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">Saved secrets</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Only provider, key name, status, and a masked hint are visible here.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {secrets.length} saved
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="i-svg-spinners:ring-resize text-2xl text-orange-500" />
            </div>
          ) : secrets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center dark:border-gray-800">
              <div className="i-ph:shield-check mx-auto mb-3 text-3xl text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No personal secrets yet</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Add one on the left to use your own provider account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret) => (
                <div
                  key={secret.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                    <div className="i-ph:key text-lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{secret.key_name}</p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {secret.enabled ? 'active' : 'disabled'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {secret.provider} · {secret.hint || '••••'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSecret(secret)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    title="Delete secret"
                  >
                    <div className="i-ph:trash text-base" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}