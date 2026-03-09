import * as p from "@clack/prompts";
import { removeHeartbeat, writeHeartbeat } from "../../shared/heartbeat.js";
import type { HeartbeatManifest } from "../../shared/types.js";
import { defineSamhailCommand } from "../command.js";
import {
  killAllWatchers,
  spawnWatcher,
  type WatcherProcess,
} from "../watcher.js";
import {
  findMissingLinkedPackage,
  getLinkedPackageSpecs,
  getStartSessionState,
} from "./start-helpers.js";

export const startCommand = defineSamhailCommand({
  meta: {
    name: "start",
    description: "Start dev watchers for all linked packages",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("samhail start");

    // 1. Read config
    const linkedPackages = await getLinkedPackageSpecs(cwd);
    if (linkedPackages.length === 0) {
      return {
        status: "error",
        message:
          "No .samhail.json found or no links configured. Run `samhail link` first.",
        detail: "Nothing to do.",
      };
    }

    // 2. Validate all link paths exist
    const missingPackage = await findMissingLinkedPackage(linkedPackages);
    if (missingPackage) {
      return {
        status: "error",
        message: `Package directory not found for "${missingPackage.name}": ${missingPackage.packageDir}`,
        detail: "Fix your .samhail.json and try again.",
      };
    }

    // 3. Check for existing heartbeat
    const sessionState = await getStartSessionState(cwd);
    if (sessionState.state === "already-running") {
      return {
        status: "error",
        message: `Another samhail session is already running (PID ${sessionState.pid}).`,
        detail: "Stop it first or remove .samhail.lock.",
      };
    }

    if (sessionState.state === "cleanup-stale") {
      p.log.warn("Cleaning up stale .samhail.lock from a previous session.");
      await removeHeartbeat(cwd);
    }

    // 4. Spawn watchers
    const watchers: WatcherProcess[] = [];
    for (const { name, link, packageDir } of linkedPackages) {
      p.log.step(`Starting watcher: ${name} → ${link.dev}`);
      watchers.push(
        spawnWatcher(name, link.dev, {
          cwd: packageDir,
          onStdout: (data) => {
            for (const line of data.trimEnd().split("\n")) {
              p.log.message(`[${name}] ${line}`);
            }
          },
          onStderr: (data) => {
            for (const line of data.trimEnd().split("\n")) {
              p.log.warn(`[${name}] ${line}`);
            }
          },
          onExit: (code) => {
            if (code !== 0) {
              p.log.error(`[${name}] exited with code ${code}`);
            } else {
              p.log.message(`[${name}] exited`);
            }
          },
        }),
      );
    }
    const packageNames = linkedPackages.map(({ name }) => name);

    // 5. Write initial heartbeat + refresh interval
    const startedAt = new Date().toISOString();

    const refreshHeartbeat = async () => {
      const manifest: HeartbeatManifest = {
        pid: process.pid,
        startedAt,
        updatedAt: new Date().toISOString(),
        watching: packageNames,
      };
      await writeHeartbeat(cwd, manifest);
    };

    await refreshHeartbeat();
    const heartbeatInterval = setInterval(async () => {
      try {
        await refreshHeartbeat();
      } catch {
        // Non-fatal: heartbeat refresh failure shouldn't crash the session
      }
    }, 5000);

    p.log.step(
      `Watching ${packageNames.length} package${packageNames.length === 1 ? "" : "s"}. Press Ctrl+C to stop.`,
    );

    // 6. Graceful shutdown (signal-based lifecycle, stays as process.exit)
    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(heartbeatInterval);
      p.log.step("Shutting down watchers...");
      await killAllWatchers(watchers);
      await removeHeartbeat(cwd);
      p.outro("samhail stopped.");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // start command runs indefinitely until signal; return ok for type safety
    return { status: "ok" };
  },
});
