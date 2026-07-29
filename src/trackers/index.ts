import { githubTracker } from './github.js';
import type { Tracker } from './types.js';

export const trackers: Tracker[] = [githubTracker];

export function getTracker(id: string): Tracker | undefined {
  return trackers.find((t) => t.id === id);
}

export type { Tracker, TrackerLabel, TrackerContext } from './types.js';
