import { copilotProvider } from './copilot.js';
import { opencodeProvider } from './opencode.js';
import type { Provider } from './types.js';

export const providers: Provider[] = [copilotProvider, opencodeProvider];

export function getProvider(id: string): Provider | undefined {
  return providers.find((p) => p.id === id);
}

export type { Provider, TemplateTarget, SetupDocData } from './types.js';
