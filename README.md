# samhail

Zero-choreography local npm package development across repos.

`samhail` lets you develop npm packages locally against a consumer app without symlinks, lockfile churn, or `node_modules` mutation. It works by resolving linked packages at the bundler level and orchestrating dev watchers from the CLI.

## Install

```bash
npm install samhail --save-dev
```

## Quick start

### 1. Add the plugin to your bundler

```ts
// vite.config.ts
import samhail from "samhail/vite";

export default defineConfig({
  plugins: [samhail()],
});
```

Also available for Webpack, Rspack, esbuild, and Rollup:

```ts
import samhail from "samhail/webpack";
import samhail from "samhail/rspack";
import samhail from "samhail/esbuild";
import samhail from "samhail/rollup";
```

### 2. Link a local package

```bash
npx samhail link
```

This walks you through picking a dependency, pointing it at a local directory, and choosing a dev command. The result is a `.samhail.json` file in your project root.

### 3. Start dev watchers

```bash
npx samhail start
```

This spawns the dev command for each linked package and keeps a heartbeat file (`.samhail.lock`) so the bundler plugin knows the session is active. Your bundler will resolve linked packages from their local directories instead of `node_modules`.

Press `Ctrl+C` to stop.

## CLI commands

| Command             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `samhail link`     | Link a dependency to a local directory                 |
| `samhail unlink`   | Remove a linked package                                |
| `samhail relink`   | Restore previously linked packages from history        |
| `samhail start`    | Start dev watchers for all linked packages             |
| `samhail status`   | Show linked packages and session state                 |
| `samhail tsconfig` | Print tsconfig paths mapping linked packages to source |

## How it works

The system has two halves that communicate through a small filesystem contract:

- **CLI** manages config (`.samhail.json`), watcher processes, and session state (`.samhail.lock`)
- **Bundler plugin** reads the config, checks if a session is active, and rewrites module resolution for linked packages

When `samhail start` is running, the plugin resolves imports of linked packages to their local directories. When it's not running, the plugin is a no-op and your bundler behaves normally.

## Config

`samhail link` generates a `.samhail.json` file:

```json
{
  "links": {
    "@myorg/shared": {
      "path": "../shared",
      "dev": "tsup --watch"
    }
  }
}
```

Add `.samhail.json` and `.samhail.lock` to your `.gitignore`.

## License

MIT
