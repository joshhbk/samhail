import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { parseSpecifier, unplugin } from "./core.js";
import { writeHeartbeat } from "../shared/heartbeat.js";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

async function createTempProject(
  config: Record<string, unknown>,
  options: { heartbeat?: boolean } = {},
) {
  const dir = join(
    tmpdir(),
    `samhail-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".samhail.json"), JSON.stringify(config), "utf-8");
  if (options.heartbeat !== false) {
    await writeHeartbeat(dir, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      watching: Object.keys(
        (config as { links?: Record<string, unknown> }).links ?? {},
      ),
    });
  }
  return dir;
}

describe("parseSpecifier", () => {
  const linked = ["@acme/ui", "@acme/core", "lodash-es"];

  it("matches exact scoped package", () => {
    expect(parseSpecifier("@acme/ui", linked)).toEqual({
      packageName: "@acme/ui",
      subpath: ".",
    });
  });

  it("matches scoped package with sub-path", () => {
    expect(parseSpecifier("@acme/ui/theme", linked)).toEqual({
      packageName: "@acme/ui",
      subpath: "./theme",
    });
  });

  it("matches deep sub-path", () => {
    expect(parseSpecifier("@acme/ui/components/Button", linked)).toEqual({
      packageName: "@acme/ui",
      subpath: "./components/Button",
    });
  });

  it("matches unscoped package", () => {
    expect(parseSpecifier("lodash-es", linked)).toEqual({
      packageName: "lodash-es",
      subpath: ".",
    });
  });

  it("returns null for non-matching import", () => {
    expect(parseSpecifier("react", linked)).toBeNull();
  });

  it("does not match partial name prefixes", () => {
    expect(parseSpecifier("@acme/ui-icons", linked)).toBeNull();
  });
});

describe("unplugin resolveId", () => {
  let projectDir: string | null = null;

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true });
      projectDir = null;
    }
  });

  async function createPlugin(cwd: string) {
    const vitePlugin = unplugin.vite({ cwd });
    const plugin = Array.isArray(vitePlugin) ? vitePlugin[0] : vitePlugin;
    if (typeof plugin.buildStart === "function") {
      // @ts-expect-error — stub context + options for testing; plugin only needs to load config
      await plugin.buildStart.call({}, {});
    }
    return plugin;
  }

  function callResolveId(
    plugin: Awaited<ReturnType<typeof createPlugin>>,
    id: string,
  ) {
    if (typeof plugin.resolveId !== "function") return null;
    return plugin.resolveId.call(
      // @ts-expect-error — stub context for testing; plugin only reads the `id` argument
      {},
      id,
      undefined,
      { isEntry: false },
    );
  }

  it("returns null when config exists but no heartbeat", async () => {
    projectDir = await createTempProject(
      {
        links: {
          "@test/exports-conditional": {
            path: join(FIXTURES, "pkg-exports-conditional"),
            dev: "echo",
          },
        },
      },
      { heartbeat: false },
    );

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "@test/exports-conditional");
    expect(result).toBeNull();
  });

  it("returns null when config exists but heartbeat is stale", async () => {
    projectDir = await createTempProject(
      {
        links: {
          "@test/exports-conditional": {
            path: join(FIXTURES, "pkg-exports-conditional"),
            dev: "echo",
          },
        },
      },
      { heartbeat: false },
    );

    await writeHeartbeat(projectDir, {
      pid: process.pid,
      startedAt: new Date(Date.now() - 30_000).toISOString(),
      updatedAt: new Date(Date.now() - 30_000).toISOString(),
      watching: ["@test/exports-conditional"],
    });
    // Backdate the file mtime so the sync staleness check sees it as old
    const staleTime = new Date(Date.now() - 30_000);
    await utimes(join(projectDir, ".samhail.lock"), staleTime, staleTime);

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "@test/exports-conditional");
    expect(result).toBeNull();
  });

  it("watches derived output roots in vite configureServer", async () => {
    projectDir = await createTempProject({
      links: {
        "@test/multi-root": {
          path: "linked",
          dev: "echo",
        },
      },
    });

    await mkdir(join(projectDir, "linked"), { recursive: true });
    await writeFile(
      join(projectDir, "linked", "package.json"),
      JSON.stringify({
        name: "@test/multi-root",
        exports: {
          ".": { import: "./build/index.js" },
          "./theme": { import: "./dist/theme.js" },
          "./components/*": { import: "./dist/components/*.js" },
        },
      }),
      "utf-8",
    );

    const plugin = await createPlugin(projectDir);
    const watched: string[] = [];
    let onClose: (() => void) | undefined;

    if (typeof plugin.configureServer !== "function") {
      throw new Error("Expected vite configureServer hook");
    }

    await plugin.configureServer.call(
      // @ts-expect-error - test stub for Vite plugin context
      {},
      {
        watcher: {
          add(path: string) {
            watched.push(path);
          },
          on() {},
        },
        config: {
          cacheDir: join(projectDir, ".vite"),
          logger: { info() {} },
        },
        async restart() {},
        httpServer: {
          on(event: string, callback: () => void) {
            if (event === "close") onClose = callback;
          },
        },
      },
    );

    onClose?.();

    expect(watched).toEqual(
      expect.arrayContaining([
        join(projectDir, "linked", "build"),
        join(projectDir, "linked", "dist"),
        join(projectDir, "linked", "dist/components"),
        join(projectDir, ".samhail.json"),
      ]),
    );
  });
});
