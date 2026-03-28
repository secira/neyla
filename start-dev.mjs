import { Blob } from 'buffer';
import { execFileSync, spawn } from 'child_process';

if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends Blob {
    constructor(fileBits, fileName, options = {}) {
      super(fileBits, options);
      this.name = fileName;
      this.lastModified = options.lastModified ?? Date.now();
    }
  };
}

const child = spawn(
  'node',
  ['pre-start.cjs'],
  { stdio: 'inherit' }
);

child.on('exit', (code) => {
  if (code !== 0) process.exit(code);

  const remix = spawn(
    process.execPath,
    ['node_modules/.bin/remix', 'vite:dev'],
    {
      stdio: 'inherit',
      env: { ...process.env }
    }
  );

  remix.on('exit', (c) => process.exit(c ?? 0));
});
