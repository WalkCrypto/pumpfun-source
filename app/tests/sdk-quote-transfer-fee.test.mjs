import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(new URL('../packages/sdk/package.json',import.meta.url));
const published=mkdtempSync(join(tmpdir(),'pump-sdk-reference-'));
mkdirSync(join(published,'swap'));
symlinkSync(join(root,'packages/sdk/node_modules'),join(published,'node_modules'),process.platform==='win32'?'junction':'dir');
for(const sub of ['index.js','swap/index.js'])writeFileSync(join(published,sub),execFileSync('tar',['-xOf',join(root,'evidence/sdk/pump-sdk-4.3.1.tgz'),`package/dist/${sub}`]));
process.on('exit',()=>rmSync(published,{recursive:true,force:true}));
const { PublicKey } = require('@solana/web3.js');
const spl = require('@solana/spl-token');

// Build a Token-2022 mint account buffer carrying a TransferFeeConfig
// extension: older fee applies below newerEpoch, newer fee at and above it.
function mintBuffer({ newerEpoch, older, newer, withExtension = true }) {
  const len = withExtension
    ? spl.getMintLen([spl.ExtensionType.TransferFeeConfig])
    : 166;
  const buf = Buffer.alloc(len);
  const zero = PublicKey.default;
  spl.MintLayout.encode({ mintAuthorityOption: 1, mintAuthority: zero, supply: BigInt(1000000), decimals: 6, isInitialized: 1, freezeAuthorityOption: 0, freezeAuthority: zero }, buf);
  if (!withExtension) { buf[165] = 1; return buf; }
  buf[165] = 1; // AccountType.Mint
  buf.writeUInt16LE(spl.ExtensionType.TransferFeeConfig, 166);
  buf.writeUInt16LE(108, 168);
  spl.TransferFeeConfigLayout.encode({
    transferFeeConfigAuthority: zero,
    withdrawWithheldAuthority: zero,
    withheldAmount: BigInt(0),
    olderTransferFee: { epoch: BigInt(0), maximumFee: BigInt(older.max), transferFeeBasisPoints: older.bps },
    newerTransferFee: { epoch: BigInt(newerEpoch), maximumFee: BigInt(newer.max), transferFeeBasisPoints: newer.bps },
  }, buf, 170);
  return buf;
}
const infoFor = (data, owner) => ({ data, executable: false, lamports: 0, owner, rentEpoch: 0 });

test('rebuilt quoteTransferFeeOf matches published across epochs and mint shapes', () => {
  const original = require(join(published, 'index.js'));
  const built = require(join(root, 'packages/sdk/dist/index.js'));
  const zero = PublicKey.default;
  const buf = mintBuffer({ newerEpoch: 50, older: { bps: 100, max: 100 }, newer: { bps: 250, max: 200 } });
  const attempt = (side, info, epoch) => {
    try {
      const value = side.quoteTransferFeeOf(zero, info, epoch);
      return value === null ? null : { bps: value.basisPoints, max: value.maximumFee.toString() };
    } catch (error) { return { error: `${error.constructor.name}: ${error.message}` }; }
  };
  for (const epoch of [0, 1, 49, 50, 51, 100, 10000]) {
    assert.deepEqual(
      attempt(built, infoFor(buf, spl.TOKEN_2022_PROGRAM_ID), epoch),
      attempt(original, infoFor(buf, spl.TOKEN_2022_PROGRAM_ID), epoch),
      `epoch ${epoch}`,
    );
  }
  // Bigint epochs take the same branch as number epochs.
  assert.deepEqual(
    attempt(built, infoFor(buf, spl.TOKEN_2022_PROGRAM_ID), BigInt(50)),
    attempt(original, infoFor(buf, spl.TOKEN_2022_PROGRAM_ID), BigInt(50)),
    'bigint epoch 50',
  );
  // Null branches: an SPL Token mint and a Token-2022 mint without the extension.
  assert.deepEqual(
    attempt(built, infoFor(buf, spl.TOKEN_PROGRAM_ID), 100),
    attempt(original, infoFor(buf, spl.TOKEN_PROGRAM_ID), 100),
    'spl owner',
  );
  const bare = mintBuffer({ newerEpoch: 50, older: { bps: 100, max: 100 }, newer: { bps: 250, max: 200 }, withExtension: false });
  assert.deepEqual(
    attempt(built, infoFor(bare, spl.TOKEN_2022_PROGRAM_ID), 100),
    attempt(original, infoFor(bare, spl.TOKEN_2022_PROGRAM_ID), 100),
    'no extension',
  );
  // A second schedule with a zero older rate and a full-rate newer schedule.
  const buf2 = mintBuffer({ newerEpoch: 10, older: { bps: 0, max: 0 }, newer: { bps: 10000, max: 5000 } });
  for (const epoch of [0, 9, 10, 11]) {
    assert.deepEqual(
      attempt(built, infoFor(buf2, spl.TOKEN_2022_PROGRAM_ID), epoch),
      attempt(original, infoFor(buf2, spl.TOKEN_2022_PROGRAM_ID), epoch),
      `second schedule epoch ${epoch}`,
    );
  }
});
