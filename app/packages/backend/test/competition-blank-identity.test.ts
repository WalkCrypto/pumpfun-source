import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CompetitionStore } from '../src/competitions-store.js';

test('competition indexes reject blank IDs and slugs before indexing', () => {
  const seed = () =>
    JSON.parse(readFileSync(new URL('../src/competitions-seed.json', import.meta.url), 'utf8'));
  const blankId = seed();
  blankId[0].id = '';
  assert.throws(() => new CompetitionStore(blankId), /Competition identity must be non-empty/);
  const blankSlug = seed();
  blankSlug[0].slug = '';
  assert.throws(() => new CompetitionStore(blankSlug), /Competition identity must be non-empty/);
  assert.doesNotThrow(() => new CompetitionStore(seed()));
});
