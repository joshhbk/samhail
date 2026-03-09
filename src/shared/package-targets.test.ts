import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPackageTargetIndex,
  deriveSourcePath,
  getPackageWatchDirs,
  resolvePackageTarget,
} from "./package-targets.js";
import type { ExportCondition } from "./types.js";

const FIXTURES = join(import.meta.dirname, "../plugin/__fixtures__");

const importConditions: ExportCondition[] = ["import", "default"];
const requireConditions: ExportCondition[] = ["require", "default"];

describe("package-targets", () => {
  let dirs: string[] = [];

  async function makeTempDir() {
    const dir = join(
      tmpdir(),
      `samhail-targets-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true });
    }
    dirs = [];
  });

  describe("resolvePackageTarget", () => {
    it("resolves exports string shorthand", () => {
      const result = resolvePackageTarget({
        packageDir: join(FIXTURES, "pkg-exports-string"),
        subpath: ".",
        conditions: importConditions,
      });

      expect(result).toEqual({
        subpath: ".",
        distPath: "./dist/index.mjs",
        sourcePath: "src/index.ts",
        watchDir: "dist",
        isWildcard: false,
      });
    });

    it("resolves conditional exports for require", () => {
      const result = resolvePackageTarget({
        packageDir: join(FIXTURES, "pkg-exports-conditional"),
        subpath: ".",
        conditions: requireConditions,
      });

      expect(result?.distPath).toBe("./dist/index.cjs");
      expect(result?.watchDir).toBe("dist");
    });

    it("falls back to module and main fields", () => {
      expect(
        resolvePackageTarget({
          packageDir: join(FIXTURES, "pkg-module-only"),
          subpath: ".",
          conditions: importConditions,
        })?.distPath,
      ).toBe("./dist/index.mjs");

      expect(
        resolvePackageTarget({
          packageDir: join(FIXTURES, "pkg-main-only"),
          subpath: ".",
          conditions: requireConditions,
        })?.distPath,
      ).toBe("./dist/index.js");
    });
  });

  describe("buildPackageTargetIndex", () => {
    it("indexes explicit and wildcard subpaths", () => {
      const result = buildPackageTargetIndex(
        join(FIXTURES, "pkg-exports-subpath"),
        importConditions,
      );

      expect(result).toEqual({
        ".": {
          subpath: ".",
          distPath: "./dist/index.mjs",
          sourcePath: "src/index.ts",
          watchDir: "dist",
          isWildcard: false,
        },
        "./theme": {
          subpath: "./theme",
          distPath: "./dist/theme.mjs",
          sourcePath: "src/theme.ts",
          watchDir: "dist",
          isWildcard: false,
        },
        "./components/*": {
          subpath: "./components/*",
          distPath: "./dist/components/*.mjs",
          sourcePath: "src/components/*",
          watchDir: "dist/components",
          isWildcard: true,
        },
      });
    });
  });

  describe("deriveSourcePath", () => {
    it("maps recognized output roots to source paths", () => {
      expect(deriveSourcePath("./dist/index.js")).toBe("src/index.ts");
      expect(deriveSourcePath("./build/utils.mjs")).toBe("src/utils.ts");
      expect(deriveSourcePath("./lib/widget.cjs")).toBe("src/widget.ts");
      expect(deriveSourcePath("./out/components/*.js")).toBe(
        "src/components/*",
      );
    });

    it("returns null for unrecognized output roots", () => {
      expect(deriveSourcePath("./release/index.js")).toBeNull();
    });
  });

  describe("getPackageWatchDirs", () => {
    it("returns unique derived watch directories", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "@test/multi-root",
          exports: {
            ".": { import: "./build/index.js" },
            "./theme": { import: "./dist/theme.js" },
            "./components/*": { import: "./dist/components/*.js" },
          },
        }),
      );

      expect(getPackageWatchDirs(dir, importConditions)).toEqual([
        "build",
        "dist",
        "dist/components",
      ]);
    });
  });
});
