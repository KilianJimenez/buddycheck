/** One template → target mapping. `from` may be a file or a directory. */
export interface TemplateTarget {
  /** Path relative to the template dir (file or directory). */
  from: string;
  /** Path relative to the target repo root (file or directory, matching `from`). */
  to: string;
  /** chmod 0o755 the written file(s). */
  executable?: boolean;
  /** Never overwrite an existing target (unless --force). */
  skipIfExists?: boolean;
}

export interface SetupDocData {
  /** Repository secrets the user must configure. */
  secrets: Array<{ name: string; description: string }>;
  /** Repository settings the user must flip. */
  repoSettings: string[];
  /** How to install / authenticate the provider CLI. */
  cliInstall: string[];
}

export interface Provider {
  id: string;
  label: string;
  /** Path relative to the packaged `templates/` root. */
  templateDir: string;
  targets: TemplateTarget[];
  setupDoc: SetupDocData;
}
