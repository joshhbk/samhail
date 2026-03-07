import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { getExportKeys, distToSrc, buildPathEntries } from "./tsconfig.js";

describe("tsconfig helpers", () => {
  let dirs: string[] = [];

  async function makeTempDir() {
    const dir = join(
      tmpdir(),
      `localdev-tsconfig-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  describe("getExportKeys", () => {
    it("returns ['.'] for string exports", () => {
      expect(getExportKeys({ exports: "./dist/index.mjs" })).toEqual(["."]);
    });

    it("returns ['.'] for condition-keyed object", () => {
      expect(
        getExportKeys({
          exports: { import: "./dist/index.mjs", require: "./dist/index.cjs" },
        }),
      ).toEqual(["."]);
    });

    it("returns all subpath keys for subpath-keyed object", () => {
      expect(
        getExportKeys({
          exports: {
            ".": { import: "./dist/index.mjs" },
            "./theme": { import: "./dist/theme.mjs" },
            "./components/*": { import: "./dist/components/*.mjs" },
          },
        }),
      ).toEqual([".", "./theme", "./components/*"]);
    });

    it("returns ['.'] when no exports field", () => {
      expect(getExportKeys({ main: "./dist/index.js" })).toEqual(["."]);
    });

    it("returns ['.'] when exports is null", () => {
      expect(getExportKeys({ exports: null })).toEqual(["."]);
    });
  });

  describe("distToSrc", () => {
    it("maps .js to .ts in dist dir", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      expect(await distToSrc(dir, "./dist/index.js")).toBe("src/index.ts");
    });

    it("maps .mjs to .ts", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      expect(await distToSrc(dir, "./dist/index.mjs")).toBe("src/index.ts");
    });

    it("maps .cjs to .ts", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      expect(await distToSrc(dir, "./dist/index.cjs")).toBe("src/index.ts");
    });

    it("falls back to .tsx when .ts does not exist", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.tsx"), "");
      expect(await distToSrc(dir, "./dist/index.js")).toBe("src/index.tsx");
    });

    it("returns null when no source file exists", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      expect(await distToSrc(dir, "./dist/index.js")).toBeNull();
    });

    it("handles build output dir", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/utils.ts"), "");
      expect(await distToSrc(dir, "./build/utils.js")).toBe("src/utils.ts");
    });

    it("handles lib output dir", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/utils.ts"), "");
      expect(await distToSrc(dir, "./lib/utils.js")).toBe("src/utils.ts");
    });

    it("handles out output dir", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/utils.ts"), "");
      expect(await distToSrc(dir, "./out/utils.js")).toBe("src/utils.ts");
    });

    it("returns null for unrecognized output dir", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      expect(await distToSrc(dir, "./release/index.js")).toBeNull();
    });
  });

  describe("buildPathEntries", () => {
    it("handles package with subpath exports", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      await writeFile(join(dir, "src/theme.ts"), "");
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "@playground/ui-kit",
          exports: {
            ".": { import: "./dist/index.mjs" },
            "./theme": { import: "./dist/theme.mjs" },
          },
        }),
      );

      const entries = await buildPathEntries(
        "@playground/ui-kit",
        dir,
        "../../packages/ui-kit",
      );
      expect(entries).toEqual({
        "@playground/ui-kit": ["../../packages/ui-kit/src/index.ts"],
        "@playground/ui-kit/theme": ["../../packages/ui-kit/src/theme.ts"],
      });
    });

    it("handles package with single export", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "@playground/core",
          exports: "./dist/index.mjs",
        }),
      );

      const entries = await buildPathEntries(
        "@playground/core",
        dir,
        "../../packages/core",
      );
      expect(entries).toEqual({
        "@playground/core": ["../../packages/core/src/index.ts"],
      });
    });

    it("handles package with main only", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "legacy-pkg",
          main: "./dist/index.js",
        }),
      );

      const entries = await buildPathEntries(
        "legacy-pkg",
        dir,
        "../../packages/legacy-pkg",
      );
      expect(entries).toEqual({
        "legacy-pkg": ["../../packages/legacy-pkg/src/index.ts"],
      });
    });

    it("handles package with wildcard exports", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src/components"), { recursive: true });
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "@playground/ui-kit",
          exports: {
            ".": { import: "./dist/index.mjs" },
            "./components/*": { import: "./dist/components/*.mjs" },
          },
        }),
      );
      await writeFile(join(dir, "src/index.ts"), "");

      const entries = await buildPathEntries(
        "@playground/ui-kit",
        dir,
        "../../packages/ui-kit",
      );
      expect(entries).toEqual({
        "@playground/ui-kit": ["../../packages/ui-kit/src/index.ts"],
        "@playground/ui-kit/components/*": [
          "../../packages/ui-kit/src/components/*",
        ],
      });
    });

    it("skips entries where source file is not found", async () => {
      const dir = await makeTempDir();
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/index.ts"), "");
      // no theme.ts exists
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "@playground/ui-kit",
          exports: {
            ".": { import: "./dist/index.mjs" },
            "./theme": { import: "./dist/theme.mjs" },
          },
        }),
      );

      const entries = await buildPathEntries(
        "@playground/ui-kit",
        dir,
        "../../packages/ui-kit",
      );
      expect(entries).toEqual({
        "@playground/ui-kit": ["../../packages/ui-kit/src/index.ts"],
      });
    });
  });
});
