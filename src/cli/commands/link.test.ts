import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  validateLinkedPackage,
  readConsumerDeps,
  discoverLocalPackage,
  readPackageScripts,
} from "./link-helpers.js";

describe("link helpers", () => {
  let dirs: string[] = [];

  async function makeTempDir() {
    const dir = join(
      tmpdir(),
      `samhail-link-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  describe("readConsumerDeps", () => {
    it("returns sorted dep names from both deps and devDeps", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "consumer",
          dependencies: { zlib: "1.0.0", "@acme/ui": "^1.0.0" },
          devDependencies: { "@acme/core": "^2.0.0", babel: "7.0.0" },
        }),
      );
      const deps = await readConsumerDeps(dir);
      expect(deps).toEqual(["@acme/core", "@acme/ui", "babel", "zlib"]);
    });

    it("returns empty array when no deps", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "consumer" }),
      );
      const deps = await readConsumerDeps(dir);
      expect(deps).toEqual([]);
    });

    it("returns empty array when no package.json", async () => {
      const dir = await makeTempDir();
      const deps = await readConsumerDeps(dir);
      expect(deps).toEqual([]);
    });
  });

  describe("discoverLocalPackage", () => {
    it("finds matching package in sibling dir", async () => {
      // Create structure: parent/consumer and parent/ui-pkg
      const parent = await makeTempDir();
      const consumer = join(parent, "consumer");
      const sibling = join(parent, "ui-pkg");
      await mkdir(consumer, { recursive: true });
      await mkdir(sibling, { recursive: true });
      await writeFile(
        join(sibling, "package.json"),
        JSON.stringify({ name: "@acme/ui" }),
      );

      const results = await discoverLocalPackage("@acme/ui", consumer);
      expect(results).toEqual([sibling]);
    });

    it("finds matching package in parent-sibling dir", async () => {
      // Create structure: grandparent/parent/consumer and grandparent/libs/ui-pkg
      const grandparent = await makeTempDir();
      const parent = join(grandparent, "apps");
      const consumer = join(parent, "consumer");
      const uncle = join(grandparent, "ui-pkg");
      await mkdir(consumer, { recursive: true });
      await mkdir(uncle, { recursive: true });
      await writeFile(
        join(uncle, "package.json"),
        JSON.stringify({ name: "@acme/ui" }),
      );

      const results = await discoverLocalPackage("@acme/ui", consumer);
      expect(results).toContain(uncle);
    });

    it("finds matching package nested one level inside a sibling dir", async () => {
      // Structure: grandparent/apps/consumer and grandparent/packages/ui-kit
      const grandparent = await makeTempDir();
      const consumer = join(grandparent, "apps", "consumer");
      const nested = join(grandparent, "packages", "ui-kit");
      await mkdir(consumer, { recursive: true });
      await mkdir(nested, { recursive: true });
      await writeFile(
        join(nested, "package.json"),
        JSON.stringify({ name: "@acme/ui" }),
      );

      const results = await discoverLocalPackage("@acme/ui", consumer);
      expect(results).toContain(nested);
    });

    it("returns empty array when no match", async () => {
      const parent = await makeTempDir();
      const consumer = join(parent, "consumer");
      await mkdir(consumer, { recursive: true });

      const results = await discoverLocalPackage("@acme/ui", consumer);
      expect(results).toEqual([]);
    });
  });

  describe("readPackageScripts", () => {
    it("returns scripts object", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "pkg",
          scripts: { dev: "tsc --watch", build: "tsc" },
        }),
      );
      const scripts = await readPackageScripts(dir);
      expect(scripts).toEqual({ dev: "tsc --watch", build: "tsc" });
    });

    it("returns empty object when no scripts field", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "pkg" }),
      );
      const scripts = await readPackageScripts(dir);
      expect(scripts).toEqual({});
    });
  });

  describe("validateLinkedPackage", () => {
    it("returns ok for matching package name", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "@acme/ui" }),
      );

      expect(await validateLinkedPackage("@acme/ui", dir)).toEqual({
        ok: true,
      });
    });

    it("returns actual name for mismatched package", async () => {
      const dir = await makeTempDir();
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "@acme/core" }),
      );

      expect(await validateLinkedPackage("@acme/ui", dir)).toEqual({
        ok: false,
        reason: "name-mismatch",
        actualName: "@acme/core",
      });
    });

    it("distinguishes missing package.json from name mismatch", async () => {
      const dir = await makeTempDir();

      expect(await validateLinkedPackage("@acme/ui", dir)).toEqual({
        ok: false,
        reason: "missing-package-json",
      });
    });
  });
});
