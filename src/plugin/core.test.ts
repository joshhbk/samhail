import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { parseSpecifier, unplugin } from "./core.js";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

async function createTempProject(config: Record<string, unknown>) {
  const dir = join(
    tmpdir(),
    `localdev-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, ".localdev.json"),
    JSON.stringify(config),
    "utf-8",
  );
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

  it("resolves exact package match to local dist", async () => {
    projectDir = await createTempProject({
      links: {
        "@test/exports-conditional": {
          path: join(FIXTURES, "pkg-exports-conditional"),
          dev: "echo",
        },
      },
    });

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "@test/exports-conditional");
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-conditional", "dist/index.mjs"),
    );
  });

  it("resolves sub-path import of a linked package", async () => {
    projectDir = await createTempProject({
      links: {
        "@test/exports-subpath": {
          path: join(FIXTURES, "pkg-exports-subpath"),
          dev: "echo",
        },
      },
    });

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "@test/exports-subpath/theme");
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-subpath", "dist/theme.mjs"),
    );
  });

  it("returns null for imports not matching any linked package", async () => {
    projectDir = await createTempProject({
      links: {
        "@test/exports-conditional": {
          path: join(FIXTURES, "pkg-exports-conditional"),
          dev: "echo",
        },
      },
    });

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "lodash");
    expect(result).toBeNull();
  });

  it("returns null when no config file exists", async () => {
    const dir = join(tmpdir(), `localdev-test-noconfig-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    projectDir = dir;

    const plugin = await createPlugin(dir);
    const result = callResolveId(plugin, "@test/exports-conditional");
    expect(result).toBeNull();
  });

  it("resolves unscoped package names", async () => {
    projectDir = await createTempProject({
      links: {
        "my-lib": {
          path: join(FIXTURES, "pkg-main-only"),
          dev: "echo",
        },
      },
    });

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(plugin, "my-lib");
    expect(result).toBe(join(FIXTURES, "pkg-main-only", "dist/index.js"));
  });

  it("resolves deep sub-path imports", async () => {
    projectDir = await createTempProject({
      links: {
        "@test/exports-subpath": {
          path: join(FIXTURES, "pkg-exports-subpath"),
          dev: "echo",
        },
      },
    });

    const plugin = await createPlugin(projectDir);
    const result = callResolveId(
      plugin,
      "@test/exports-subpath/components/Button",
    );
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-subpath", "dist/components/Button.mjs"),
    );
  });
});
