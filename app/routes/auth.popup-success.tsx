import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';

export default function AuthPopupSuccess() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('auth_error');

  useEffect(() => {
    if (window.opener) {
      if (authError) {
        window.opener.postMessage({ type: 'oauth_error', error: authError }, window.location.origin);
      } else {
        window.opener.postMessage({ type: 'oauth_success' }, window.location.origin);
      }
      window.close();
    } else {
      if (authError) {
        window.location.href = `/login?auth_error=${authError}`;
      } else {
        window.location.href = '/';
      }
    }
  }, [authError]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid #f97316',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        <p style={{ color: '#aaa', fontSize: 14 }}>
          {authError ? 'Login failed. Closing…' : 'Logging you in…'}
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
