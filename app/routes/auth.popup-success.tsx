import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';

export default function AuthPopupSuccess() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('auth_error');

  useEffect(() => {
    if (authError) {
      localStorage.setItem('oauth_result', JSON.stringify({ type: 'error', error: authError }));
    } else {
      localStorage.setItem('oauth_result', JSON.stringify({ type: 'success', ts: Date.now() }));
    }

    // Give localStorage a moment to sync to other windows, then close
    setTimeout(() => window.close(), 200);
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
