# Config

## `.localdev.json`

Created by `localdev link`. The bundler plugin reads this to know what to resolve locally.

```json
{
  "links": {
    "@myorg/shared": {
      "path": "../shared",
      "dev": "tsup --watch"
    }
  },
  "history": {
    "@myorg/utils": {
      "path": "../utils",
      "dev": "tsc --watch"
    }
  }
}
```

### `links`

Active linked packages. Keys are npm package names.

| Field  | Type     | Description                              |
| ------ | -------- | ---------------------------------------- |
| `path` | `string` | Path to the local package directory      |
| `dev`  | `string` | Command to run for watching / rebuilding |

Paths can be relative or absolute. Relative paths resolve from the project root.

### `history`

Packages previously removed with `localdev unlink`. Same shape as `links`. Used by `localdev relink` to restore entries without going through the interactive flow again.

## `.localdev.lock`

Written by `localdev start`, updated every 5 seconds. The plugin reads this to decide whether to activate.

```json
{
  "pid": 12345,
  "startedAt": "2026-03-08T12:00:00.000Z",
  "updatedAt": "2026-03-08T12:05:00.000Z",
  "watching": ["@myorg/shared"]
}
```

The plugin considers a session active when all three hold:

1. The file exists and parses as valid JSON
2. `updatedAt` is less than 10 seconds old
3. The process at `pid` is still alive

If any check fails, the plugin does nothing. This prevents stale config from silently breaking builds after a crash.

Both files belong in `.gitignore`.
