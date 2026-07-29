import { describe, expect, it } from 'vitest';
import { isRenderable, renderTemplate } from './template.js';

const vars = { OWNER: 'octocat', REPO: 'buddycheck', REPO_SLUG: 'octocat/buddycheck' };

describe('renderTemplate', () => {
  it('substitutes every occurrence of each placeholder', () => {
    const out = renderTemplate(
      'owner={{OWNER}} repo={{REPO}} slug={{REPO_SLUG}} again={{OWNER}}',
      vars,
    );
    expect(out).toBe('owner=octocat repo=buddycheck slug=octocat/buddycheck again=octocat');
  });

  it('leaves content without placeholders untouched', () => {
    expect(renderTemplate('plain text {not a placeholder}', vars)).toBe('plain text {not a placeholder}');
  });

  it('throws when an unresolved placeholder remains', () => {
    expect(() => renderTemplate('hello {{MISSING_VAR}}', vars)).toThrow(/\{\{MISSING_VAR\}\}/);
  });

  it('ignores lowercase mustaches (not our placeholder syntax)', () => {
    expect(renderTemplate('{{ owner }} {{lower}}', vars)).toBe('{{ owner }} {{lower}}');
  });
});

describe('isRenderable', () => {
  it('accepts the documented extensions only', () => {
    expect(isRenderable('a/b.md')).toBe(true);
    expect(isRenderable('a/b.yml')).toBe(true);
    expect(isRenderable('a/b.sh')).toBe(true);
    expect(isRenderable('a/b.json')).toBe(true);
    expect(isRenderable('a/b.png')).toBe(false);
    expect(isRenderable('a/b.yaml')).toBe(false);
    expect(isRenderable('a/Dockerfile')).toBe(false);
  });
});
