import { useEffect, useState } from 'react';
import { useNavigate, Link } from '@remix-run/react';
import { authUserAtom, authLoadingAtom, fetchCurrentUser } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';

export default function Signup() {
  const navigate = useNavigate();
  const user = useStore(authUserAtom);
  const loading = useStore(authLoadingAtom);
  const [name, setName] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        setError(data.error || 'Signup failed');
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

  const openOAuthPopup = (url: string) => {
    const w = 500, h = 650;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(url, 'oauth_popup', `width=${w},height=${h},left=${left},top=${top},popup=yes`);

    if (!popup) {
      window.location.href = url;
      return;
    }

    const channel = new BroadcastChannel('oauth_result');

    channel.onmessage = (e) => {
      channel.close();

      if (e.data?.type === 'oauth_success') {
        window.location.href = '/';
      } else if (e.data?.type === 'oauth_error') {
        setError('Authentication failed. Please try again.');
      }
    };
  };

  const handleGitHubLogin = () => openOAuthPopup('/api/auth/github');
  const handleGoogleLogin = () => openOAuthPopup('/api/auth/google');

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
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-1">Create your account</h1>
            <p className="text-bolt-elements-textSecondary text-sm mb-6">Start building with AI — free forever</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors font-medium text-sm mb-3"
            >
              <div className="i-ph:github-logo text-lg" />
              Continue with GitHub
            </button>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors font-medium text-sm mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-bolt-elements-borderColor" />
              <span className="text-bolt-elements-textTertiary text-xs">or continue with email</span>
              <div className="flex-1 h-px bg-bolt-elements-borderColor" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 text-sm"
                />
              </div>

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
                <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  className="w-full px-3 py-2.5 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs text-bolt-elements-textTertiary mt-4">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>

            <p className="text-center text-sm text-bolt-elements-textSecondary mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-orange-400 hover:text-orange-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
