export interface LocaldevLink {
  /** Relative or absolute path to the local package directory */
  path: string;
  /** Command to run for watching/rebuilding the package */
  dev: string;
}

export interface LocaldevConfig {
  links: Record<string, LocaldevLink>;
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
