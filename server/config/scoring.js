import { readFileSync } from 'node:fs';

/** Scoring weights and grade bands, loaded from scoring.json so they can be tuned without code changes. */
export const scoringConfig = Object.freeze(JSON.parse(readFileSync(new URL('./scoring.json', import.meta.url), 'utf8')));
