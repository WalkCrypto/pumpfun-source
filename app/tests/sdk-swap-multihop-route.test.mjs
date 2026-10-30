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
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const BN = require('bn.js');

const published = mkdtempSync(join(tmpdir(), 'pump-sdk-swap-reference-'));
mkdirSync(join(published, 'swap'));
symlinkSync(join(root, 'packages/sdk/node_modules'), join(published, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(published, 'swap/index.js'), execFileSync('tar', ['-xOf', join(root, 'evidence/sdk/pump-sdk-4.3.1.tgz'), 'package/dist/swap/index.js']));
process.on('exit', () => rmSync(published, { recursive: true, force: true }));

const original = require(join(published, 'swap/index.js'));
const built = require(join(root, 'packages/sdk/dist/swap/index.js'));

const zero = PublicKey.default;
const key = (label) => new PublicKey(createHash('sha256').update(`multihop-${label}`).digest());
const A = key('A');
const B = key('B');
const C = key('C');
const D = key('D');
const curve = (base, quote) => ({ kind: 'curve', baseMint: base, quoteMint: quote, baseTokenProgram: TOKEN_PROGRAM_ID, quoteTokenProgram: TOKEN_PROGRAM_ID });
const pool = (base, quote, opts = {}) => ({
  kind: 'pool', poolKey: key(`pool-${base.toBase58().slice(0, 4)}-${quote.toBase58().slice(0, 4)}`),
  pool: {
    poolBump: 0, index: 0, creator: built.pumpPoolAuthorityPda(base), baseMint: base, quoteMint: quote,
    lpMint: key('lp'), poolBaseTokenAccount: key('ba'), poolQuoteTokenAccount: key('qa'),
    lpSupply: new BN(1000), coinCreator: key('cc'), isMayhemMode: !!opts.mayhem,
    isCashbackCoin: !!opts.cashback, virtualQuoteReserves: new BN(0), creatorFeeBps: new BN(0),
  },
  baseTokenProgram: TOKEN_PROGRAM_ID, quoteTokenProgram: TOKEN_PROGRAM_ID,
});

const stringify = (value) => {
  if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'PublicKey') return value.toBase58();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringify(v)]));
  return value;
};
const attempt = (run) => {
  try {
    return { value: stringify(run()) };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
};
const eq = (label, inMint, venues) => assert.deepEqual(
  attempt(() => built.resolveMultiHopRoute(inMint, venues)),
  attempt(() => original.resolveMultiHopRoute(inMint, venues)),
  label,
);

test('rebuilt swap resolveMultiHopRoute matches published', () => {
  // #1883 covers multiHopSwapQuote pricing; this covers the route resolver
  // itself: direction, running mints, leg fees, and every refusal.
  eq('single curve buy', C, [curve(B, C)]);
  eq('single curve sell', B, [curve(B, C)]);
  eq('two curve buy chain', C, [curve(B, C), curve(A, B)]);
  eq('two curve sell chain', A, [curve(A, B), curve(B, C)]);
  eq('single pool buy', C, [pool(B, C)]);
  eq('two pool buy', C, [pool(B, C), pool(A, B)]);
  eq('discontinuous hop', A, [curve(B, C)]);
  eq('mixed direction', C, [curve(B, C), curve(B, A)]);
  eq('empty route', C, []);
  eq('seven hops exceed heap', C, [curve(B, C), curve(A, B), curve(B, C), curve(A, B), curve(B, C), curve(A, B), curve(B, C)]);
  eq('six hops with four pools exceed heap', C, [pool(B, C), pool(A, B), pool(B, C), pool(A, B), curve(B, C), curve(A, B)]);
  // Boundary: six hops with exactly three pools is allowed.
  const M0 = key('M0');
  const M1 = key('M1');
  const M2 = key('M2');
  const M3 = key('M3');
  const M4 = key('M4');
  const M5 = key('M5');
  const M6 = key('M6');
  eq('six hops with three pools allowed', M6, [pool(M5, M6), pool(M4, M5), pool(M3, M4), curve(M2, M3), curve(M1, M2), curve(M0, M1)]);
  eq('mayhem pool refused', C, [pool(B, C, { mayhem: true })]);
  eq('non-pump pool refused', C, [{ ...pool(B, C), pool: { ...pool(B, C).pool, creator: key('notauth') } }]);
  eq('cashback pool charging creator refused', C, [curve(B, C), pool(A, B, { cashback: true })]);
  eq('cashback pool not charging creator allowed', D, [curve(C, D), pool(B, C, { cashback: true }), curve(A, B)]);
  eq('zero inMint canonicalized to WSOL', zero, [curve(B, zero)]);
});
