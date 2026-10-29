import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

const throws = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.message;
  }
  return null;
};

test('rebuilt platform mapping matches published', () => {
  // The enum itself agrees, not just the lookups.
  assert.deepEqual(built.Platform, original.Platform);
  // Every defined platform round-trips through both directions.
  for (const value of Object.values(built.Platform).filter((entry) => typeof entry === 'number')) {
    assert.equal(built.platformToString(value), original.platformToString(value), `platformToString(${value})`);
    assert.equal(built.stringToPlatform(built.platformToString(value)), original.stringToPlatform(original.platformToString(value)), `round-trip ${value}`);
  }
  // Parsing is case-insensitive and trims whitespace on both sides.
  for (const spelling of ['pump', 'PUMP', ' pump ', 'x', 'X', 'github', 'GITHUB', 'GitHub']) {
    assert.equal(built.stringToPlatform(spelling), original.stringToPlatform(spelling), `stringToPlatform(${JSON.stringify(spelling)})`);
  }
  // The commented-out platforms (Discord, Telegram, TikTok, ...) are not
  // valid values, and unknown inputs fail with identical messages.
  for (const bad of ['twitter', 'Telegram', 'Discord', 'TikTok', '', '  ']) {
    assert.equal(throws(() => built.stringToPlatform(bad)), throws(() => original.stringToPlatform(bad)), `stringToPlatform(${JSON.stringify(bad)}) error`);
  }
  for (const bad of [3, 13, 99, -1]) {
    assert.equal(throws(() => built.platformToString(bad)), throws(() => original.platformToString(bad)), `platformToString(${bad}) error`);
  }
});
