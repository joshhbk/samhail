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
import type { LocaldevConfig, LocaldevLink } from "../shared/types.js";

export interface LocaldevPluginOptions {
  /** Project root directory. Defaults to process.cwd() */
  cwd?: string;
  /**
   * Inline link map (package name → local path). When provided, the plugin
   * resolves from these links directly — no .localdev.json, no heartbeat,
   * no CLI required. The consumer is responsible for running their own
   * dev watchers.
   */
  links?: Record<string, string>;
}

function inlineLinksToConfig(links: Record<string, string>): LocaldevConfig {
  const entries: Record<string, LocaldevLink> = {};
  for (const [name, path] of Object.entries(links)) {
    entries[name] = { path, dev: "" };
  }
  return { links: entries };
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

// Minimal Vite server shape used by lifecycle setup. Avoids importing vite types.
interface ViteServerLike {
  watcher: {
    add(path: string): void;
    on(event: string, callback: (path: string) => void): void;
  };
  config: {
    cacheDir: string;
    logger: { info(msg: string, opts?: { timestamp: boolean }): void };
  };
  restart(): Promise<void>;
  httpServer?: { on(event: string, callback: () => void): void } | null;
}

function watchLinkedOutputDirs(
  watcher: { add(path: string): void },
  cwd: string,
  config: LocaldevConfig,
) {
  for (const link of Object.values(config.links)) {
    const packageDir = resolve(cwd, link.path);
    for (const dir of getPackageWatchDirs(
      packageDir,
      DEFAULT_EXPORT_CONDITIONS,
    )) {
      watcher.add(resolve(packageDir, dir));
    }
  }
}

function setupCliLifecycle(server: ViteServerLike, cwd: string) {
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

  // Poll heartbeat so Vite restarts when a CLI session starts or stops.
  let heartbeatWasAlive = isHeartbeatFreshSync(cwd);
  const heartbeatPoll = setInterval(() => {
    const alive = isHeartbeatFreshSync(cwd);
    if (alive !== heartbeatWasAlive) {
      heartbeatWasAlive = alive;
      restartServer("localdev session changed, restarting...");
    }
  }, 2000);
  server.httpServer?.on("close", () => clearInterval(heartbeatPoll));
}

export const unplugin = createUnplugin((options?: LocaldevPluginOptions) => {
  const cwd = options?.cwd ?? process.cwd();
  const inlineConfig = options?.links
    ? inlineLinksToConfig(options.links)
    : null;

  const rawConfigReady = inlineConfig
    ? Promise.resolve(inlineConfig)
    : readConfig(cwd);

  // Cached config, populated in buildStart for use in sync hooks.
  let rawConfig: LocaldevConfig | null = inlineConfig;

  return {
    name: "localdev",
    enforce: "pre",

    async buildStart() {
      if (inlineConfig) {
        rawConfig = inlineConfig;
      } else {
        rawConfig = await readConfig(cwd);
        if (typeof this.addWatchFile === "function") {
          this.addWatchFile(getConfigPath(cwd));
        }
      }
    },

    resolveId(id) {
      if (!rawConfig) return null;
      if (!inlineConfig && !isHeartbeatFreshSync(cwd)) return null;

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
      async config() {
        const raw = await rawConfigReady;
        if (!raw) return;
        return {
          optimizeDeps: {
            exclude: Object.keys(raw.links),
          },
        };
      },

      async configureServer(server) {
        const raw = await rawConfigReady;
        if (raw) {
          watchLinkedOutputDirs(server.watcher, cwd, raw);
        }

        if (!inlineConfig) {
          setupCliLifecycle(server, cwd);
        }
      },
    },
  };
});
