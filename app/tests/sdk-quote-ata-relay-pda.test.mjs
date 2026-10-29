import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-reference-'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'index.js'));
const built = require(join(root, 'packages/sdk/dist/index.js'));

const probe = (label) => new PublicKey(createHash('sha256').update(`ata-relay-probe-${label}`).digest());

test('rebuilt quoteAta and donationRelayPda match published', () => {
  // quoteAta is the one address derivation #530's PDA loop never exercised:
  // it is an associated token address, not a program address, and it takes a
  // token program. The off-curve owner matters: quoteAta allows off-curve
  // owners, so a PDA owner must still resolve instead of throwing.
  const owners = [probe('owner-a'), probe('owner-b'), built.bondingCurvePda(probe('mint-a'))];
  const mints = [new PublicKey('So11111111111111111111111111111111111111112'), probe('mint-a')];
  const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  for (const owner of owners) {
    for (const mint of mints) {
      for (const program of programs) {
        assert.equal(
          built.quoteAta(owner, mint, program).toBase58(),
          original.quoteAta(owner, mint, program).toBase58(),
          `quoteAta ${owner.toBase58()} ${mint.toBase58()} ${program.toBase58()}`,
        );
      }
    }
  }

  // donationRelayPda is the raw primitive behind the covered wrappers; the
  // wrappers pin their own seeds, but arbitrary seed sets are uncompared.
  const relayPrograms = [built.DONATION_RELAY_PROGRAM_ID_MAINNET, built.DONATION_RELAY_PROGRAM_ID_DEVNET];
  const seedSets = [
    [Buffer.from('mint_whitelist_v1')],
    [Buffer.from('epoch_tracker_v1'), probe('config').toBuffer()],
    [Buffer.from('custom'), Buffer.from([1, 2, 3])],
  ];
  for (const program of relayPrograms) {
    for (const seeds of seedSets) {
      assert.equal(
        built.donationRelayPda(seeds, program).toBase58(),
        original.donationRelayPda(seeds, program).toBase58(),
        `donationRelayPda ${program.toBase58()} ${seeds.map((seed) => seed.toString('hex')).join(':')}`,
      );
    }
  }
});
