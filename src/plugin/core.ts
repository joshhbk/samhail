import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createUnplugin } from "unplugin";
import { readConfig } from "../shared/config.js";
import { isHeartbeatAlive } from "../shared/heartbeat.js";
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

async function loadActiveConfig(
  cwd: string,
): Promise<LocaldevConfig | null> {
  const config = await readConfig(cwd);
  if (!config) return null;
  const alive = await isHeartbeatAlive(cwd);
  return alive ? config : null;
}

export const unplugin = createUnplugin((options?: LocaldevPluginOptions) => {
  const cwd = options?.cwd ?? process.cwd();
  let config: LocaldevConfig | null = null;
  const configReady = loadActiveConfig(cwd).then((c) => {
    config = c;
  });

  return {
    name: "localdev",
    enforce: "pre",

    async buildStart() {
      await configReady;
    },

    resolveId(id) {
      if (!config) return null;

      const linkedNames = Object.keys(config.links);
      const parsed = parseSpecifier(id, linkedNames);
      if (!parsed) return null;

      const link = config.links[parsed.packageName];
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
      if (!config) return false;
      const linkedNames = Object.keys(config.links);
      return linkedNames.some(
        (name) =>
          id.startsWith(resolve(cwd, config!.links[name].path)),
      );
    },

    load(id) {
      return readFileSync(id, "utf-8");
    },

    vite: {
      // Exclude linked packages from dep pre-bundling so our resolveId runs
      async config() {
        await configReady;
        if (!config) return;
        return {
          optimizeDeps: {
            exclude: Object.keys(config.links),
          },
        };
      },
      // Watch linked package dist directories so HMR picks up rebuilds
      configureServer(server) {
        if (!config) return;
        for (const link of Object.values(config.links)) {
          server.watcher.add(resolve(cwd, link.path, "dist"));
        }
      },
    },
  };
});
