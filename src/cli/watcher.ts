import { join } from "node:path";
import { execa, type ResultPromise } from "execa";

export interface WatcherCallbacks {
  cwd: string;
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number) => void;
}

export interface WatcherProcess {
  name: string;
  process: ResultPromise;
  exited: boolean;
}

export function spawnWatcher(
  name: string,
  command: string,
  callbacks: WatcherCallbacks,
): WatcherProcess {
  const localBin = join(callbacks.cwd, "node_modules", ".bin");
  const env = {
    ...process.env,
    PATH: `${localBin}:${process.env.PATH ?? ""}`,
  };
  const proc = execa({
    shell: true,
    reject: false,
    cwd: callbacks.cwd,
    env,
  })`${command}`;

  const watcher: WatcherProcess = {
    name,
    process: proc,
    exited: false,
  };

  proc.stdout?.on("data", (chunk: Buffer) => {
    callbacks.onStdout(chunk.toString());
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    callbacks.onStderr(chunk.toString());
  });

  proc.then((result) => {
    watcher.exited = true;
    callbacks.onExit(result.exitCode ?? 1);
  });

  return watcher;
}

export async function killAllWatchers(
  watchers: WatcherProcess[],
  timeoutMs = 5000,
): Promise<void> {
  const active = watchers.filter((w) => !w.exited);
  if (active.length === 0) return;

  for (const w of active) {
    w.process.kill("SIGTERM");
  }

  const deadline = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  await Promise.race([Promise.all(active.map((w) => w.process)), deadline]);

  // SIGKILL any stragglers
  for (const w of active) {
    if (!w.exited) {
      w.process.kill("SIGKILL");
    }
  }

  await Promise.all(active.map((w) => w.process));
}
