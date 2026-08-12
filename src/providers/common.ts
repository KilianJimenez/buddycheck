import type { TemplateTarget } from './types.js';

/**
 * Provider-independent templates. Single source of truth for the
 * `templates/common/` → target-repo mapping.
 */
export const COMMON_TEMPLATE_DIR = 'common';

export const COMMON_TARGETS: TemplateTarget[] = [
  { from: 'docs', to: '.buddy/docs' },
  { from: 'AGENTS.md', to: 'AGENTS.md', skipIfExists: true },
];
