export interface SamhailLink {
  /** Relative or absolute path to the local package directory */
  path: string;
  /** Command to run for watching/rebuilding the package */
  dev: string;
}

export interface SamhailConfig {
  links: Record<string, SamhailLink>;
  history?: Record<string, SamhailLink>;
}

export type ExportCondition =
  | "import"
  | "require"
  | "default"
  | "node"
  | "browser"
  | "module"
  | "types"
  | "development"
  | "production";

export interface ResolveLinkedPackageOptions {
  packageDir: string;
  subpath: string;
  conditions: ExportCondition[];
}

export interface HeartbeatManifest {
  pid: number;
  startedAt: string;
  updatedAt: string;
  watching: string[];
}
