import { useState } from 'react';

export function ConfigPanel() {
  const [nodeVersion, setNodeVersion] = useState('18.x');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [startCommand, setStartCommand] = useState('npm start');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-5">
      <div>
        <h2 className="text-sm font-semibold text-bolt-elements-textPrimary">Config</h2>
        <p className="text-xs text-bolt-elements-textTertiary mt-0.5">Workspace runtime settings</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-bolt-elements-textSecondary">Node.js version</label>
          <select
            value={nodeVersion}
            onChange={(e) => setNodeVersion(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary outline-none focus:border-orange-500/50 appearance-none"
          >
            <option value="16.x">16.x</option>
            <option value="18.x">18.x (recommended)</option>
            <option value="20.x">20.x</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-bolt-elements-textSecondary">Build command</label>
          <input
            type="text"
            value={buildCommand}
            onChange={(e) => setBuildCommand(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary outline-none focus:border-orange-500/50 font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-bolt-elements-textSecondary">Start command</label>
          <input
            type="text"
            value={startCommand}
            onChange={(e) => setStartCommand(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary outline-none focus:border-orange-500/50 font-mono"
          />
        </div>

        <div className="p-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
          <p className="text-xs font-medium text-bolt-elements-textSecondary mb-2">Runtime</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-bolt-elements-textTertiary">E2B Sandbox (cloud execution)</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full text-xs font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
        >
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
