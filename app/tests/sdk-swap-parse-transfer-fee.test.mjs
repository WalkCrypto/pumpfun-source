import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../packages/sdk/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType } = require('@solana/spl-token');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const key = (label) => new PublicKey(createHash('sha256').update(`parse-tfc-${label}`).digest());

// A Token-2022 mint account buffer: the 82-byte mint layout, padding to the
// 165-byte account size, the Mint account-type byte, then one TLV extension.
const mintBuffer = (extension) => {
  const base = Buffer.alloc(166);
  base.writeUInt32LE(0, 0);
  key('authority').toBuffer().copy(base, 4);
  base.writeBigUInt64LE(1000000n, 36);
  base.writeUInt8(6, 44);
  base.writeUInt8(1, 45);
  base.writeUInt32LE(0, 46);
  key('freeze').toBuffer().copy(base, 50);
  base.writeUInt8(1, 165);
  return extension ? Buffer.concat([base, extension]) : base;
};
const transferFeeExtension = (older, newer) => {
  const ext = Buffer.alloc(4 + 108);
  ext.writeUInt16LE(ExtensionType.TransferFeeConfig, 0);
  ext.writeUInt16LE(108, 2);
  let o = 4;
  key('tfc-authority').toBuffer().copy(ext, o); o += 32;
  key('withdraw-authority').toBuffer().copy(ext, o); o += 32;
  ext.writeBigUInt64LE(12345n, o); o += 8;
  for (const fee of [older, newer]) {
    ext.writeBigUInt64LE(BigInt(fee.epoch), o); o += 8;
    ext.writeBigUInt64LE(BigInt(fee.maximumFee), o); o += 8;
    ext.writeUInt16LE(fee.basisPoints, o); o += 2;
  }
  return ext;
};
const stringify = (value) => JSON.stringify(value, (k, v) => typeof v === 'bigint' ? v.toString() : v);
const eq = (label, mint, info) => assert.equal(
  stringify(built.parseTransferFeeConfig(mint, info)),
  stringify(original.parseTransferFeeConfig(mint, info)),
  label,
);

test('rebuilt swap parseTransferFeeConfig matches published', () => {
  const mint = key('mint');
  const infoFor = (data, owner) => ({ address: mint, owner, lamports: 1000000, data, executable: false });
  // #95 covers transferFeeAt/transferFeeOn but deliberately left this
  // decoder out: it needs a valid Token-2022 mint account buffer.
  eq(
    'Token-2022 mint with a transfer-fee config',
    mint,
    infoFor(mintBuffer(transferFeeExtension(
      { epoch: 0, maximumFee: 1000, basisPoints: 50 },
      { epoch: 100, maximumFee: 5000, basisPoints: 200 },
    )), TOKEN_2022_PROGRAM_ID),
  );
  eq(
    'second schedule variant',
    mint,
    infoFor(mintBuffer(transferFeeExtension(
      { epoch: 10, maximumFee: 0, basisPoints: 0 },
      { epoch: 20, maximumFee: 999999, basisPoints: 10000 },
    )), TOKEN_2022_PROGRAM_ID),
  );
  eq('Token-2022 mint without the extension', mint, infoFor(mintBuffer(null), TOKEN_2022_PROGRAM_ID));
  eq('non-Token-2022 owner', mint, infoFor(mintBuffer(transferFeeExtension(
    { epoch: 0, maximumFee: 1000, basisPoints: 50 },
    { epoch: 100, maximumFee: 5000, basisPoints: 200 },
  )), TOKEN_PROGRAM_ID));
  eq(
    'unrelated extension type',
    mint,
    infoFor(Buffer.concat([mintBuffer(null), Buffer.from([2, 0, 4, 0, 1, 2, 3, 4])]), TOKEN_2022_PROGRAM_ID),
  );
});
