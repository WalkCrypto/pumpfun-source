import test from "node:test";
import assert from "node:assert/strict";
import { userToProfile } from "../src/posts-store.js";
import type { User } from "../src/users-store.js";
const user = (address: string, username: string | null): User => ({
  address,
  userId: "user-blank-name",
  username,
  profile_image: null,
  bio: null,
  followers: 0,
  following: 0,
  x_username: null,
});
test("profiles fall back to the address prefix when the stored username is blank", () => {
  assert.equal(
    userToProfile(user("BlankWallet1111111111111111111111111111", ""), false)
      .username,
    "BlankWal",
  );
  assert.equal(
    userToProfile(user("BlankWallet1111111111111111111111111111", null), false)
      .username,
    "BlankWal",
  );
  assert.equal(
    userToProfile(user("NormalWallet2222222222222222222222222222", "alice"), false)
      .username,
    "alice",
  );
});
