import { useState } from 'react';

interface Secret {
  key: string;
  value: string;
  visible: boolean;
}

export function SecretsPanel() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const addSecret = () => {
    if (!newKey.trim()) return;
    setSecrets((prev) => [...prev, { key: newKey.trim(), value: newValue, visible: false }]);
    setNewKey('');
    setNewValue('');
    setAdding(false);
  };

  const removeSecret = (idx: number) => {
    setSecrets((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleVisible = (idx: number) => {
    setSecrets((prev) => prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s)));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-bolt-elements-textPrimary">Secrets</h2>
          <p className="text-xs text-bolt-elements-textTertiary mt-0.5">Environment variables for your workspace</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-orange-500/40 transition-colors"
        >
          <div className="i-ph:plus text-sm" />
          Add
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
          <input
            type="text"
            placeholder="KEY_NAME"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
            className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary outline-none focus:border-orange-500/50 font-mono"
          />
          <input
            type="text"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary outline-none focus:border-orange-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={addSecret}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
            >
              Save
            </button>
            <button
              onClick={() => { setAdding(false); setNewKey(''); setNewValue(''); }}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {secrets.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)' }}
          >
            <div className="i-ph:key text-2xl" style={{ color: '#FF6B2B' }} />
          </div>
          <div>
            <p className="text-sm font-medium text-bolt-elements-textSecondary mb-1">No secrets yet</p>
            <p className="text-xs text-bolt-elements-textTertiary leading-relaxed">
              Add API keys and env variables for your project
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {secrets.map((secret, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-bolt-elements-textPrimary truncate">{secret.key}</p>
                <p className="text-xs font-mono text-bolt-elements-textTertiary truncate">
                  {secret.visible ? secret.value : '••••••••'}
                </p>
              </div>
              <button
                onClick={() => toggleVisible(idx)}
                className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary shrink-0"
              >
                <div className={`${secret.visible ? 'i-ph:eye-slash' : 'i-ph:eye'} text-sm`} />
              </button>
              <button
                onClick={() => removeSecret(idx)}
                className="text-bolt-elements-textTertiary hover:text-red-400 shrink-0"
              >
                <div className="i-ph:trash text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
