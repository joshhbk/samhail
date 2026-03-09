import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createUnplugin } from "unplugin";
import { getConfigPath, readConfig } from "../shared/config.js";
import { isHeartbeatFreshSync } from "../shared/heartbeat.js";
import {
  DEFAULT_EXPORT_CONDITIONS,
  getPackageWatchDirs,
  resolvePackageTarget,
} from "../shared/package-targets.js";
import type { SamhailConfig } from "../shared/types.js";

export interface SamhailPluginOptions {
  /** Project root directory. Defaults to process.cwd() */
  cwd?: string;
}

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

export const unplugin = createUnplugin((options?: SamhailPluginOptions) => {
  const cwd = options?.cwd ?? process.cwd();

  // Raw config from .samhail.json (no heartbeat check). Used for Vite setup
  // (optimizeDeps, watcher) so these are configured even if samhail starts
  // after the dev server.
  const rawConfigReady = readConfig(cwd);

  // Cached raw config, populated in buildStart for use in sync hooks.
  let rawConfig: SamhailConfig | null = null;

  return {
    name: "samhail",
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
      // Resolve hooks stay sync, so the plugin uses freshness-only mtime checks
      // here rather than the canonical async heartbeat status helper.
      if (!rawConfig || !isHeartbeatFreshSync(cwd)) return null;

      const linkedNames = Object.keys(rawConfig.links);
      const parsed = parseSpecifier(id, linkedNames);
      if (!parsed) return null;

      const link = rawConfig.links[parsed.packageName];
      const packageDir = resolve(cwd, link.path);

      const target = resolvePackageTarget({
        packageDir,
        subpath: parsed.subpath,
        conditions: DEFAULT_EXPORT_CONDITIONS,
      });
      return target ? join(packageDir, target.distPath) : null;
    },

    // esbuild: unplugin's esbuild adapter puts resolved paths into the plugin's
    // namespace, so esbuild won't auto-load them from disk. This load hook reads
    // the file contents for paths we resolved. Other bundlers ignore loadInclude
    // returning false and skip this entirely.
    loadInclude(id) {
      if (!rawConfig) return false;
      const linkedNames = Object.keys(rawConfig.links);
      return linkedNames.some((name) =>
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
      // Uses raw config so the watcher is set up even if samhail starts later.
      async configureServer(server) {
        const raw = await rawConfigReady;
        if (raw) {
          for (const link of Object.values(raw.links)) {
            const packageDir = resolve(cwd, link.path);
            for (const watchDir of getPackageWatchDirs(
              packageDir,
              DEFAULT_EXPORT_CONDITIONS,
            )) {
              server.watcher.add(resolve(packageDir, watchDir));
            }
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

        // Watch .samhail.json for link/unlink changes.
        const configPath = getConfigPath(cwd);
        server.watcher.add(configPath);
        for (const event of ["change", "add", "unlink"] as const) {
          server.watcher.on(event, (path) => {
            if (path === configPath) {
              restartServer("samhail config changed, restarting...");
            }
          });
        }

        let heartbeatWasAlive = isHeartbeatFreshSync(cwd);
        const heartbeatPoll = setInterval(() => {
          const alive = isHeartbeatFreshSync(cwd);
          if (alive !== heartbeatWasAlive) {
            heartbeatWasAlive = alive;
            restartServer("samhail session changed, restarting...");
          }
        }, 2000);
        server.httpServer?.on("close", () => clearInterval(heartbeatPoll));
      },
    },
  };
});
