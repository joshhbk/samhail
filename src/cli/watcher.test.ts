import { describe, expect, it, vi } from "vitest";
import { spawnWatcher, killAllWatchers } from "./watcher.js";

describe("spawnWatcher", () => {
  it("captures stdout via onStdout", async () => {
    const chunks: string[] = [];
    const watcher = spawnWatcher("test-pkg", 'echo "hello from watcher"', {
      cwd: process.cwd(),
      onStdout: (data) => chunks.push(data),
      onStderr: () => {},
      onExit: () => {},
    });

    await watcher.process;
    expect(chunks.join("")).toContain("hello from watcher");
  });

  it("captures stderr via onStderr", async () => {
    const chunks: string[] = [];
    const watcher = spawnWatcher("test-pkg", 'echo "err" >&2', {
      cwd: process.cwd(),
      onStdout: () => {},
      onStderr: (data) => chunks.push(data),
      onExit: () => {},
    });

    await watcher.process;
    expect(chunks.join("")).toContain("err");
  });

  it("reports correct exit code via onExit", async () => {
    const onExit = vi.fn();
    const watcher = spawnWatcher("test-pkg", "exit 42", {
      cwd: process.cwd(),
      onStdout: () => {},
      onStderr: () => {},
      onExit,
    });

    await watcher.process;
    expect(onExit).toHaveBeenCalledWith(42);
  });

  it("sets exited flag when process ends", async () => {
    const watcher = spawnWatcher("test-pkg", "exit 0", {
      cwd: process.cwd(),
      onStdout: () => {},
      onStderr: () => {},
      onExit: () => {},
    });

    expect(watcher.exited).toBe(false);
    await watcher.process;
    expect(watcher.exited).toBe(true);
  });
});

describe("killAllWatchers", () => {
  it("terminates running processes", { timeout: 15_000 }, async () => {
    const watcher = spawnWatcher("test-pkg", "sleep 60", {
      cwd: process.cwd(),
      onStdout: () => {},
      onStderr: () => {},
      onExit: () => {},
    });

    expect(watcher.exited).toBe(false);
    await killAllWatchers([watcher]);
    expect(watcher.exited).toBe(true);
  });
});
