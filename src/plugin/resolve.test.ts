import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExportCondition } from "../shared/types.js";
import { resolveLinkedPackage } from "./resolve.js";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

const importConditions: ExportCondition[] = ["import", "default"];
const requireConditions: ExportCondition[] = ["require", "default"];

describe("resolveLinkedPackage", () => {
  it("resolves exports string shorthand", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-exports-string"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-string", "dist/index.mjs"),
    );
  });

  it("resolves conditional exports for import", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-exports-conditional"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-conditional", "dist/index.mjs"),
    );
  });

  it("resolves conditional exports for require", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-exports-conditional"),
      subpath: ".",
      conditions: requireConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-conditional", "dist/index.cjs"),
    );
  });

  it("resolves sub-path exports", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-exports-subpath"),
      subpath: "./theme",
      conditions: importConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-subpath", "dist/theme.mjs"),
    );
  });

  it("resolves sub-path exports for require", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-exports-subpath"),
      subpath: "./theme",
      conditions: requireConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-exports-subpath", "dist/theme.cjs"),
    );
  });

  it("falls back to main field", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-main-only"),
      subpath: ".",
      conditions: requireConditions,
    });
    expect(result).toBe(join(FIXTURES, "pkg-main-only", "dist/index.js"));
  });

  it("falls back to main field when import condition but no module field", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-main-only"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBe(join(FIXTURES, "pkg-main-only", "dist/index.js"));
  });

  it("falls back to module field for import conditions", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-module-only"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBe(
      join(FIXTURES, "pkg-module-only", "dist/index.mjs"),
    );
  });

  it("returns null for module field when require conditions", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-module-only"),
      subpath: ".",
      conditions: requireConditions,
    });
    expect(result).toBeNull();
  });

  it("returns null when no entry point fields exist", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "pkg-no-entry"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBeNull();
  });

  it("returns null for non-existent packageDir", () => {
    const result = resolveLinkedPackage({
      packageDir: join(FIXTURES, "does-not-exist"),
      subpath: ".",
      conditions: importConditions,
    });
    expect(result).toBeNull();
  });
});
