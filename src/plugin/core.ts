import { readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createUnplugin } from "unplugin";
import { getConfigPath, readConfig } from "../shared/config.js";
import { getHeartbeatPath } from "../shared/heartbeat.js";
import type { LocaldevConfig, ExportCondition } from "../shared/types.js";
import { resolveLinkedPackage } from "./resolve.js";

export interface LocaldevPluginOptions {
  /** Project root directory. Defaults to process.cwd() */
  cwd?: string;
}

export const DEFAULT_CONDITIONS: ExportCondition[] = [
  "import",
  "module",
  "default",
];

export function parseSpecifier(
  id: string,
  linkedNames: string[],
): { packageName: string; subpath: string } | null {
  for (const name of linkedNames) {
    if (id === name) {
      return { packageName: name, subpath: "." };
    }
    if (id.startsWith(name + "/")) {
      return { packageName: name, subpath: "./" + id.slice(name.length + 1) };
    }
  }
  return null;
}

// Sync heartbeat check: returns true if the lock file exists and was
// modified recently. Avoids async I/O in resolveId which is called
// per module request.
const STALENESS_MS = 10_000;

function isHeartbeatAliveSync(cwd: string): boolean {
  try {
    const s = statSync(getHeartbeatPath(cwd));
    return Date.now() - s.mtimeMs < STALENESS_MS;
  } catch {
    return false;
  }
}

export const unplugin = createUnplugin((options?: LocaldevPluginOptions) => {
  const cwd = options?.cwd ?? process.cwd();

  // Raw config from .localdev.json (no heartbeat check). Used for Vite setup
  // (optimizeDeps, watcher) so these are configured even if localdev starts
  // after the dev server.
  const rawConfigReady = readConfig(cwd);

  // Cached raw config, populated in buildStart for use in sync hooks.
  let rawConfig: LocaldevConfig | null = null;

  return {
    name: "localdev",
    enforce: "pre",

    async buildStart() {
      // Re-read config each build so webpack/rspack watch mode picks up
      // link/unlink changes. Vite handles this via server restarts instead.
      rawConfig = await readConfig(cwd);
      if (typeof this.addWatchFile === "function") {
        this.addWatchFile(getConfigPath(cwd));
      }
    },

    resolveId(id) {
      if (!rawConfig || !isHeartbeatAliveSync(cwd)) return null;

      const linkedNames = Object.keys(rawConfig.links);
      const parsed = parseSpecifier(id, linkedNames);
      if (!parsed) return null;

      const link = rawConfig.links[parsed.packageName];
      const packageDir = resolve(cwd, link.path);

      return resolveLinkedPackage({
        packageDir,
        subpath: parsed.subpath,
        conditions: DEFAULT_CONDITIONS,
      });
    },

    // esbuild: unplugin's esbuild adapter puts resolved paths into the plugin's
    // namespace, so esbuild won't auto-load them from disk. This load hook reads
    // the file contents for paths we resolved. Other bundlers ignore loadInclude
    // returning false and skip this entirely.
    loadInclude(id) {
      if (!rawConfig) return false;
      const linkedNames = Object.keys(rawConfig.links);
      return linkedNames.some(
        (name) =>
          id.startsWith(resolve(cwd, rawConfig!.links[name].path)),
      );
    },

    load(id) {
      return readFileSync(id, "utf-8");
    },

    vite: {
      // Exclude linked packages from dep pre-bundling so our resolveId runs.
      // Uses raw config (no heartbeat) so this works regardless of start order.
      async config() {
        const raw = await rawConfigReady;
        if (!raw) return;
        return {
          optimizeDeps: {
            exclude: Object.keys(raw.links),
          },
        };
      },
      // Watch linked package dist directories so HMR picks up rebuilds.
      // Uses raw config so the watcher is set up even if localdev starts later.
      async configureServer(server) {
        const raw = await rawConfigReady;
        if (raw) {
          for (const link of Object.values(raw.links)) {
            server.watcher.add(resolve(cwd, link.path, "dist"));
          }
        }

        let restartTimer: ReturnType<typeof setTimeout> | null = null;
        const restartServer = (reason: string) => {
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(async () => {
            restartTimer = null;
            try {
              rmSync(server.config.cacheDir, { recursive: true, force: true });
            } catch {}
            server.config.logger.info(reason, { timestamp: true });
            await server.restart();
          }, 200);
        };

        // Watch .localdev.json for link/unlink changes.
        const configPath = getConfigPath(cwd);
        server.watcher.add(configPath);
        for (const event of ["change", "add", "unlink"] as const) {
          server.watcher.on(event, (path) => {
            if (path === configPath) {
              restartServer("localdev config changed, restarting...");
            }
          });
        }

        let heartbeatWasAlive = isHeartbeatAliveSync(cwd);
        const heartbeatPoll = setInterval(() => {
          const alive = isHeartbeatAliveSync(cwd);
          if (alive !== heartbeatWasAlive) {
            heartbeatWasAlive = alive;
            restartServer("localdev session changed, restarting...");
          }
        }, 2000);
        server.httpServer?.on("close", () => clearInterval(heartbeatPoll));
      },
    },
  };
});
