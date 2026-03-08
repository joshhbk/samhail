# Why localdev

You maintain a package. Another project uses it. You need to iterate on both at the same time.

Your options are all bad:

- **`npm link`** creates symlinks that break peer dependencies, duplicate module instances, and produce errors that have nothing to do with your actual code.
- **Monorepo workspaces** force both projects into the same repo.
- **`npm pack` + install** works, but "build, pack, install, restart" on every change is not a development loop — it's a punishment.

`localdev` takes a different approach. Instead of touching `node_modules` or your lockfile, it tells your bundler to resolve specific packages from their local directories. That's it.

Two moving parts:

1. A **CLI** that spawns dev watchers for your linked packages and writes a heartbeat file so the plugin knows the session is alive.
2. A **bundler plugin** that reads the config, checks the heartbeat, and rewrites resolution.

When the CLI is running, your bundler pulls linked packages from disk. When it's not, the plugin is inert. Your builds are always clean.
