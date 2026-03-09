import { mkdir, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { writeHeartbeat } from "../../shared/heartbeat.js";
import type { SamhailLink } from "../../shared/types.js";
import {
  findMissingLinkedPackage,
  getStartSessionState,
  type LinkedPackageSpec,
} from "./start-helpers.js";

describe("start helpers", () => {
  let dirs: string[] = [];

  async function makeTempDir() {
    const dir = join(
      tmpdir(),
      `samhail-start-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  function makePackageSpec(
    name: string,
    packageDir: string,
    link: SamhailLink = { path: "../pkg", dev: "npm run dev" },
  ): LinkedPackageSpec {
    return { name, link, packageDir };
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true });
    }
    dirs = [];
  });

  it("reports running session when heartbeat is active", async () => {
    const dir = await makeTempDir();
    await writeHeartbeat(dir, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      watching: ["@acme/ui"],
    });

    expect(await getStartSessionState(dir)).toEqual({
      state: "already-running",
      pid: process.pid,
    });
  });

  it("reports cleanup when heartbeat is stale", async () => {
    const dir = await makeTempDir();
    const staleIso = new Date(Date.now() - 30_000).toISOString();
    await writeHeartbeat(dir, {
      pid: process.pid,
      startedAt: staleIso,
      updatedAt: staleIso,
      watching: ["@acme/ui"],
    });
    const staleTime = new Date(Date.now() - 30_000);
    await utimes(join(dir, ".samhail.lock"), staleTime, staleTime);

    expect(await getStartSessionState(dir)).toEqual({
      state: "cleanup-stale",
    });
  });

  it("detects the first missing package path", async () => {
    const dir = await makeTempDir();
    const present = join(dir, "present");
    await mkdir(present, { recursive: true });

    expect(
      await findMissingLinkedPackage([
        makePackageSpec("@acme/present", present),
        makePackageSpec("@acme/missing", join(dir, "missing")),
      ]),
    ).toEqual(makePackageSpec("@acme/missing", join(dir, "missing")));
  });
});
