import test from "node:test";
import assert from "node:assert/strict";
import { UserStore } from "../src/users-store.js";

// Two distinct usernames that collate identically under localeCompare:
// precomposed U+00E9 vs "e" + combining acute U+0301. A locale-only sort
// key returns 0 for them, so the served user order falls back to seed
// insertion order instead of being a total order over distinct usernames.
// Sibling of the competitions userId tie-break fix: same localeCompare-only
// pattern, in the shared users sort comparator used by list() and search().
const PRECOMPOSED = "é";
const DECOMPOSED = "é";

const user = (username: string, suffix: string) => ({
  address: `addr-${suffix}`,
  userId: `u-${suffix}`,
  username,
  profile_image: null,
  bio: null,
  followers: 10,
  following: 10,
  x_username: null,
});

for (const order of ["asc", "desc"] as const) {
  test(`users list sort=username ${order} does not depend on seed insertion order`, () => {
    const forward = new UserStore([
      user(PRECOMPOSED, "1"),
      user(DECOMPOSED, "2"),
    ]).list({ sort: "username", order });
    const reversed = new UserStore([
      user(DECOMPOSED, "2"),
      user(PRECOMPOSED, "1"),
    ]).list({ sort: "username", order });
    assert.deepEqual(
      reversed.map((u) => u.username),
      forward.map((u) => u.username),
    );
  });
}
