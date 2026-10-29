import test from 'node:test';
import assert from 'node:assert/strict';
import { CompetitionStore, type RawCompetition } from '../src/competitions-store.js';
import seed from '../src/competitions-seed.json' with { type: 'json' };

function seedWithTokenChainId(value: unknown): RawCompetition[] {
  const competitions = structuredClone(seed) as unknown as RawCompetition[];
  const entry = competitions
    .flatMap(competition => competition.entries)
    .find(candidate => (candidate.highlightTokens?.length ?? 0) > 0);
  assert.ok(entry, 'expected an entry with highlight tokens');
  (entry.highlightTokens![0] as unknown as Record<string, unknown>).chainId = value;
  return competitions;
}

function seedWithPositionChainId(value: unknown): RawCompetition[] {
  const competitions = structuredClone(seed) as unknown as RawCompetition[];
  const entry = competitions
    .flatMap(competition => competition.entries)
    .find(candidate => (candidate.positions?.length ?? 0) > 0);
  assert.ok(entry, 'expected an entry with positions');
  (entry.positions![0] as unknown as Record<string, unknown>).chainId = value;
  return competitions;
}

test('competition nested chain ids must be finite numbers, like the entry measures', () => {
  for (const value of ['0', null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new CompetitionStore(seedWithTokenChainId(value)),
      /finite/i,
      `highlight token chainId = ${String(value)}`,
    );
    assert.throws(
      () => new CompetitionStore(seedWithPositionChainId(value)),
      /finite/i,
      `position chainId = ${String(value)}`,
    );
  }
});

test('finite nested chain ids, including zero, remain accepted', () => {
  assert.doesNotThrow(() => new CompetitionStore(seedWithTokenChainId(0)));
  assert.doesNotThrow(() => new CompetitionStore(seedWithPositionChainId(0)));
  assert.doesNotThrow(() => new CompetitionStore());
});
