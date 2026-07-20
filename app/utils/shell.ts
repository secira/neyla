import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';
import { atom } from 'nanostores';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { e2bCommands } from '~/lib/e2b/client';

type ShimContainer = {
  spawn: (cmd: string, args?: string[], opts?: any) => Promise<any>;
  workdir?: string;
};

export async function newShellProcess(webcontainer: ShimContainer, terminal: ITerminal) {
  terminal.write('\r\n\x1b[32m[Neyla Sandbox]\x1b[0m Connected\r\n');
  terminal.write('\x1b[90mThis terminal shows AI command output. To run commands, ask Neyla in the chat.\x1b[0m\r\n');
  terminal.write('\x1b[90mTip: if your preview stopped, ask Neyla to \x1b[0m\x1b[33m"restart the dev server"\x1b[0m\x1b[90m.\x1b[0m\r\n');

  return {
    output: new ReadableStream(),
    exit: Promise.resolve(0),
    kill: () => {},
    resize: () => {},
    input: { getWriter: () => ({ write: async () => {}, close: async () => {} }) },
  };
}

export type ExecutionResult = { output: string; exitCode: number } | undefined;

export class BoltShell {
  #initialized: (() => void) | undefined;
  #readyPromise: Promise<void>;
  #terminal: ITerminal | undefined;
  #currentCommand: string | null = null;

  executionState = atom<
    { sessionId: string; active: boolean; executionPrms?: Promise<any>; abort?: () => void } | undefined
  >();

  constructor() {
    this.#readyPromise = new Promise((resolve) => {
      this.#initialized = resolve;
    });
  }

  ready() {
    return this.#readyPromise;
  }

  async init(_webcontainer: any, terminal: ITerminal) {
    this.#terminal = terminal;

    terminal.write('\r\n\x1b[32m[E2B Sandbox]\x1b[0m Ready\r\n');

    this.#initialized?.();
  }

  get terminal() {
    return this.#terminal;
  }

  get process() {
    return undefined;
  }

  async executeCommand(sessionId: string, command: string, abort?: () => void): Promise<ExecutionResult> {
    if (!this.#terminal) {
      return undefined;
    }

    const state = this.executionState.get();

    if (state?.active && state.abort) {
      state.abort();
    }

    this.#terminal.write(`\r\n\x1b[36m$ ${command}\x1b[0m\r\n`);

    let aborted = false;
    const abortFn = () => {
      aborted = true;

      if (abort) {
        abort();
      }
    };

    const executionPromise = this._runE2BCommand(command, abortFn);
    this.executionState.set({ sessionId, active: true, executionPrms: executionPromise, abort: abortFn });

    const result = await executionPromise;
    this.executionState.set({ sessionId, active: false });

    if (result) {
      try {
        result.output = cleanTerminalOutput(result.output);
      } catch {
        // ignore
      }
    }

    return result;
  }

  private async _runE2BCommand(command: string, onAbort?: () => void): Promise<ExecutionResult> {
    let outputBuffer = '';

    try {
      const { exitCode } = await e2bCommands.stream(command, {
        onStdout: (data: string) => {
          outputBuffer += data;

          if (this.#terminal) {
            this.#terminal.write(data);
          }

          const expoUrlRegex = /(exp:\/\/[^\s]+)/;
          const match = data.match(expoUrlRegex);

          if (match) {
            const cleanUrl = match[1]
              .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
              .replace(/[^\x20-\x7E]+$/g, '');
            expoUrlAtom.set(cleanUrl);
          }
        },
        onStderr: (data: string) => {
          outputBuffer += data;

          if (this.#terminal) {
            this.#terminal.write(`\x1b[31m${data}\x1b[0m`);
          }
        },
      });

      if (this.#terminal) {
        this.#terminal.write(`\r\n\x1b[32m[exit: ${exitCode}]\x1b[0m\r\n`);
      }

      return { output: outputBuffer, exitCode };
    } catch (error: any) {
      const msg = error?.message || 'Command failed';
      outputBuffer += `\nError: ${msg}`;

      if (this.#terminal) {
        this.#terminal.write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`);
      }

      return { output: outputBuffer, exitCode: 1 };
    }
  }

  async getCurrentExecutionResult(): Promise<ExecutionResult> {
    return { output: '', exitCode: 0 };
  }

  async waitTillOscCode(_waitCode: string) {
    return { output: '', exitCode: 0 };
  }

  async newBoltShellProcess(_webcontainer: any, terminal: ITerminal) {
    return {
      process: { output: new ReadableStream(), input: { getWriter: () => ({ write: async () => {} }) }, kill: () => {}, resize: () => {} },
      terminalStream: new ReadableStream(),
      commandStream: new ReadableStream(),
      expoUrlStream: new ReadableStream(),
    };
  }
}

export function cleanTerminalOutput(input: string): string {
  const removeOsc = input
    .replace(/\x1b\](\d+;[^\x07\x1b]*|\d+[^\x07\x1b]*)\x07/g, '')
    .replace(/\](\d+;[^\n]*|\d+[^\n]*)/g, '');

  const removeAnsi = removeOsc
    .replace(/\u001b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\u001b/g, '')
    .replace(/\x1b/g, '');

  const cleanNewlines = removeAnsi
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const formatOutput = cleanNewlines
    .replace(/^([~\/][^\n❯]+)❯/m, '$1\n❯')
    .replace(/(?<!^|\n)>/g, '\n>')
    .replace(/(?<!^|\n|\w)(error|failed|warning|Error|Failed|Warning):/g, '\n$1:')
    .replace(/(?<!^|\n|\/)(at\s+(?!async|sync))/g, '\nat ')
    .replace(/\bat\s+async/g, 'at async')
    .replace(/(?<!^|\n)(npm ERR!)/g, '\n$1');

  return formatOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/:\s+/g, ': ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\u0000/g, '');
}

export function newBoltShellProcess() {
  return new BoltShell();
}
