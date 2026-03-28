import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from '@remix-run/react';
import { authUserAtom, authLoadingAtom, fetchCurrentUser } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useStore(authUserAtom);
  const loading = useStore(authLoadingAtom);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const authError = searchParams.get('auth_error');

    if (authError) {
      const messages: Record<string, string> = {
        invalid_state: 'Authentication failed. Please try again.',
        github_token_failed: 'GitHub login failed. Please try again.',
        github_failed: 'GitHub login failed. Please try again.',
      };
      setError(messages[authError] || 'Authentication failed.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        authUserAtom.set(data.user);
        navigate('/');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github';
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bolt-elements-background-depth-1">
      <div className="flex items-center px-6 h-14 border-b border-bolt-elements-borderColor">
        <Link to="/" className="flex items-center gap-1">
          <span
            className="text-xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 50%, #784BA0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Skech
          </span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-1">Welcome back</h1>
            <p className="text-bolt-elements-textSecondary text-sm mb-6">Sign in to your Skech account</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors font-medium text-sm mb-4"
            >
              <div className="i-ph:github-logo text-lg" />
              Continue with GitHub
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-bolt-elements-borderColor" />
              <span className="text-bolt-elements-textTertiary text-xs">or continue with email</span>
              <div className="flex-1 h-px bg-bolt-elements-borderColor" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-bolt-elements-textSecondary">Password</label>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
              >
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-sm text-bolt-elements-textSecondary mt-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-orange-400 hover:text-orange-300 font-medium">
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
