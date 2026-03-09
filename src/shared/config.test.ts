import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { readConfig, writeConfig } from "./config.js";

describe("config", () => {
  let dirs: string[] = [];

  async function makeTempDir() {
    const dir = join(
      tmpdir(),
      `samhail-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  describe("readConfig", () => {
    it("reads config with history", async () => {
      const dir = await makeTempDir();
      await writeConfig(dir, {
        links: { "@acme/ui": { path: "../ui", dev: "tsc --watch" } },
        history: { "@acme/core": { path: "../core", dev: "bun dev" } },
      });

      const config = await readConfig(dir);
      expect(config).toEqual({
        links: { "@acme/ui": { path: "../ui", dev: "tsc --watch" } },
        history: { "@acme/core": { path: "../core", dev: "bun dev" } },
      });
    });

    it("reads config without history (regression)", async () => {
      const dir = await makeTempDir();
      await writeConfig(dir, {
        links: { "@acme/ui": { path: "../ui", dev: "tsc --watch" } },
      });

      const config = await readConfig(dir);
      expect(config).toEqual({
        links: { "@acme/ui": { path: "../ui", dev: "tsc --watch" } },
      });
    });

    it("rejects malformed history", async () => {
      const dir = await makeTempDir();
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        join(dir, ".samhail.json"),
        JSON.stringify({
          links: {},
          history: { bad: { path: 123 } },
        }),
      );

      const config = await readConfig(dir);
      expect(config).toBeNull();
    });

    it("rejects history with missing dev field", async () => {
      const dir = await makeTempDir();
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        join(dir, ".samhail.json"),
        JSON.stringify({
          links: {},
          history: { pkg: { path: "../pkg" } },
        }),
      );

      const config = await readConfig(dir);
      expect(config).toBeNull();
    });

    it("returns null for missing config file", async () => {
      const dir = await makeTempDir();
      const config = await readConfig(dir);
      expect(config).toBeNull();
    });
  });

  describe("writeConfig + readConfig round-trip", () => {
    it("preserves history through write and read", async () => {
      const dir = await makeTempDir();
      const original = {
        links: { "@acme/ui": { path: "../ui", dev: "tsc --watch" } },
        history: {
          "@acme/core": { path: "../core", dev: "bun dev" },
          "@acme/utils": { path: "../utils", dev: "npm run build:watch" },
        },
      };

      await writeConfig(dir, original);
      const roundTripped = await readConfig(dir);
      expect(roundTripped).toEqual(original);
    });

    it("writes valid JSON with trailing newline", async () => {
      const dir = await makeTempDir();
      await writeConfig(dir, {
        links: {},
        history: { pkg: { path: "../pkg", dev: "dev" } },
      });

      const raw = await readFile(join(dir, ".samhail.json"), "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});
