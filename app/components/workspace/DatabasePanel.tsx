import { useState } from 'react';

export function DatabasePanel() {
  const [connected, setConnected] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState('');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-bolt-elements-textPrimary">Database</h2>
          <p className="text-xs text-bolt-elements-textTertiary mt-0.5">Connect a PostgreSQL or Supabase database</p>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Connected
          </span>
        )}
      </div>

      {!connected ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 py-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)' }}
          >
            <div className="i-ph:database text-2xl" style={{ color: '#FF6B2B' }} />
          </div>
          <div>
            <p className="text-sm font-medium text-bolt-elements-textSecondary mb-1">No database connected</p>
            <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">
              Connect a database to query it with AI
            </p>
          </div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              Connect Database
            </button>
          ) : (
            <div className="w-full flex flex-col gap-2">
              <input
                type="text"
                placeholder="postgresql://user:pass@host/db"
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary outline-none focus:border-orange-500/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (connectionUrl) setConnected(true);
                    setShowForm(false);
                  }}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
                >
                  Connect
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
            <p className="text-xs font-medium text-bolt-elements-textSecondary mb-0.5">Connection</p>
            <p className="text-xs text-bolt-elements-textTertiary font-mono truncate">{connectionUrl || 'postgresql://...'}</p>
          </div>
          <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-center">
            <p className="text-xs text-bolt-elements-textTertiary">Ask Skech to query your database in the chat</p>
          </div>
          <button
            onClick={() => { setConnected(false); setConnectionUrl(''); }}
            className="text-xs text-bolt-elements-textTertiary hover:text-red-400 transition-colors text-left"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
