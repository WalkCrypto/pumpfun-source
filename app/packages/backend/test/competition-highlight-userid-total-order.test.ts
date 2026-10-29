import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CompetitionStore } from "../src/competitions-store.js";

const seed = () =>
  JSON.parse(
    readFileSync(new URL("../src/competitions-seed.json", import.meta.url), "utf8"),
  );

// Two distinct userIds that collate identically under localeCompare:
// precomposed U+00E9 vs "e" + combining acute U+0301. A locale-only
// tie-break returns 0 for them, so the served order falls back to seed
// insertion order instead of being a total order over distinct identities.
const PRECOMPOSED = "é";
const DECOMPOSED = "é";

function withCollatingMembers(data: any) {
  const comp = data.find((c: any) => c.entries.some((e: any) => e.highlightTokens?.length));
  const entry = comp.entries.find((e: any) => e.highlightTokens?.length);
  const token = entry.highlightTokens[0];
  const base = token.members[0];
  token.members = [
    { ...base, userId: PRECOMPOSED },
    { ...base, userId: DECOMPOSED },
  ];
  return { comp, entry, token };
}

test("entry highlight member order does not depend on seed insertion order", () => {
  const data = seed();
  const { comp, entry } = withCollatingMembers(data);
  const ids = (d: any) =>
    new CompetitionStore(d)
      .getEntryHighlights(comp.id, entry.entryId)!
      .tokens[0].members.map((m) => m.userId);
  const expected = ids(data);
  // Reverse the member list and re-read: a total order must give the same order.
  const data2 = seed();
  const second = withCollatingMembers(data2);
  second.token.members.reverse();
  const store = new CompetitionStore(data2);
  assert.deepEqual(
    store.getEntryHighlights(second.comp.id, second.entry.entryId)!.tokens[0].members.map((m) => m.userId),
    expected,
  );
});

test("competition highlight row order does not depend on seed insertion order", () => {
  const data = seed();
  const { comp } = withCollatingMembers(data);
  const ids = (d: any) =>
    new CompetitionStore(d)
      .getCompetitionHighlights(comp.id)!
      .rows.filter((r) => [PRECOMPOSED, DECOMPOSED].includes(r.userId))
      .map((r) => r.userId);
  const expected = ids(data);
  assert.equal(expected.length, 2);
  const data2 = seed();
  const second = withCollatingMembers(data2);
  second.token.members.reverse();
  assert.deepEqual(
    new CompetitionStore(data2)
      .getCompetitionHighlights(second.comp.id)!
      .rows.filter((r) => [PRECOMPOSED, DECOMPOSED].includes(r.userId))
      .map((r) => r.userId),
    expected,
  );
});
