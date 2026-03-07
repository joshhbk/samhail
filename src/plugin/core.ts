import { resolve } from "node:path";
import { createUnplugin } from "unplugin";
import { readConfig } from "../shared/config.js";
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

export const unplugin = createUnplugin((options?: LocaldevPluginOptions) => {
  const cwd = options?.cwd ?? process.cwd();
  let config: LocaldevConfig | null = null;

  return {
    name: "localdev",

    async buildStart() {
      config = await readConfig(cwd);
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
  };
});
