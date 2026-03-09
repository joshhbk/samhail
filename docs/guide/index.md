# Why samhail

When you maintain an npm package used by another project, you often need to iterate on both at the same time. The usual approaches each have trade-offs:

- **`npm link`** uses symlinks, which can cause issues with peer dependencies and duplicate module instances.
- **Monorepo workspaces** require both projects to live in the same repo.
- **`npm pack` + install** is reliable but requires a manual build-pack-install cycle on every change.

`samhail` works at the bundler level instead. Rather than modifying `node_modules` or the lockfile, it has the bundler resolve specific packages from their local directories during development.

There are two parts:

1. A **CLI** that spawns dev watchers for linked packages and maintains a heartbeat file so the plugin knows a session is active.
2. A **bundler plugin** that reads the config, checks the heartbeat, and rewrites module resolution for linked packages.

When the CLI is running, linked packages resolve from their local directories. When it's not, the plugin is inactive and builds behave normally.
