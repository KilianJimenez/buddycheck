export interface TemplateVars {
  OWNER: string;
  REPO: string;
  REPO_SLUG: string;
}

/** File extensions whose contents go through placeholder substitution. */
export const RENDERABLE_EXTENSIONS = ['.md', '.yml', '.sh', '.json'] as const;

const UNRESOLVED = /\{\{[A-Z_]+\}\}/;

export function isRenderable(filePath: string): boolean {
  return RENDERABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Substitute `{{OWNER}}`, `{{REPO}}` and `{{REPO_SLUG}}` in `content`.
 * Throws if any `{{PLACEHOLDER}}` remains unresolved afterwards.
 */
export function renderTemplate(content: string, vars: TemplateVars): string {
  let out = content;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  const leftover = UNRESOLVED.exec(out);
  if (leftover) {
    throw new Error(`Unresolved template placeholder ${leftover[0]}`);
  }

  return out;
}
