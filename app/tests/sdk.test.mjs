import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(new URL('../packages/sdk/package.json',import.meta.url));
const BN=require('bn.js');
const published=mkdtempSync(join(tmpdir(),'pump-sdk-reference-'));
mkdirSync(join(published,'swap'));
symlinkSync(join(root,'packages/sdk/node_modules'),join(published,'node_modules'),process.platform==='win32'?'junction':'dir');
for(const sub of ['index.js','swap/index.js'])writeFileSync(join(published,sub),execFileSync('tar',['-xOf',join(root,'evidence/sdk/pump-sdk-4.3.1.tgz'),`package/dist/${sub}`]));
process.on('exit',()=>rmSync(published,{recursive:true,force:true}));
for(const sub of ['index','swap/index']) {
 test(`rebuilt ${sub} retains published exports in CJS and ESM`,async()=>{
  const reference=require(join(published,`${sub}.js`));
  const rebuilt=require(join(root,'packages/sdk/dist',`${sub}.js`));
  const esm=await import(new URL(`../packages/sdk/dist/${sub}.mjs`,import.meta.url));
  assert.deepEqual(Object.keys(rebuilt).sort(),Object.keys(reference).sort());
  assert.deepEqual(Object.keys(esm).sort(),Object.keys(reference).sort());
 });
}
test('rebuilt PDA constants and derivations match published root and swap',()=>{
 const {PublicKey}=require('@solana/web3.js');
 const original=require(join(published,'index.js')), built=require(join(root,'packages/sdk/dist/index.js'));
 const originalSwap=require(join(published,'swap/index.js')), builtSwap=require(join(root,'packages/sdk/dist/swap/index.js'));
 const keys=[]; for(let i=0;i<8;i++)keys.push(new PublicKey(createHash('sha256').update(`pump-sdk-pda-probe-${i}`).digest()));
 keys.push(new PublicKey(new Uint8Array(32)),original.PUMP_PROGRAM_ID,original.PUMP_AMM_PROGRAM_ID,original.PUMP_FEE_PROGRAM_ID);
 const eq=(label,a,b)=>assert.equal(a.toBase58(),b.toBase58(),label);
 for(const [label,reference,rebuilt] of [['root',original,built],['swap',originalSwap,builtSwap]])
  for(const name of Object.keys(reference)) if(reference[name]&&typeof reference[name].toBase58==='function') eq(`${label} constant ${name}`,reference[name],rebuilt[name]);
 const oneKey=['bondingCurvePda','bondingCurveV2Pda','creatorVaultPda','holderRewardsPda','pumpPoolAuthorityPda','canonicalPumpPoolPda','boostVaultAuthorityPda','getMayhemStatePda','getTokenVaultPda','feeSharingConfigPda','ammCreatorVaultPda','getEventAuthorityPda'];
 for(const fn of oneKey)for(const key of keys)eq(`${fn} ${key.toBase58()}`,original[fn](key),built[fn](key));
 for(const base of keys.slice(0,4))for(const quote of keys.slice(4,6)){
  eq('canonicalPumpPoolPdaWithQuote',original.canonicalPumpPoolPdaWithQuote(base,quote),built.canonicalPumpPoolPdaWithQuote(base,quote));
  eq('donationFeePda',original.donationFeePda(base,quote),built.donationFeePda(base,quote));
  eq('userVolumeAccumulatorPda',original.userVolumeAccumulatorPda(base),built.userVolumeAccumulatorPda(base));
  for(const program of [original.DONATION_RELAY_PROGRAM_ID_MAINNET,original.DONATION_RELAY_PROGRAM_ID_DEVNET]){
   eq('donationRelayEpochTrackerPda',original.donationRelayEpochTrackerPda(base,quote,program),built.donationRelayEpochTrackerPda(base,quote,program));
   eq('donationRelayDebouncerPda',original.donationRelayDebouncerPda(base,quote,program),built.donationRelayDebouncerPda(base,quote,program));
  }
 }
 for(const program of [original.DONATION_RELAY_PROGRAM_ID_MAINNET,original.DONATION_RELAY_PROGRAM_ID_DEVNET]){
  eq('donationRelayMintWhitelistPda',original.donationRelayMintWhitelistPda(program),built.donationRelayMintWhitelistPda(program));
  eq('donationRelayEventAuthorityPda',original.donationRelayEventAuthorityPda(program),built.donationRelayEventAuthorityPda(program));
 }
 for(const platform of [0,1,2,3,255])eq(`socialFeePda ${platform}`,original.socialFeePda('user-42',platform),built.socialFeePda('user-42',platform));
 for(const key of keys.slice(0,4))eq('swap lpMintPda',originalSwap.lpMintPda(key),builtSwap.lpMintPda(key));
});
test('rebuilt transfer fee math matches published root and swap across caps and rounding',()=>{
 const original=require(join(published,'index.js')), built=require(join(root,'packages/sdk/dist/index.js'));
 const originalSwap=require(join(published,'swap/index.js')),builtSwap=require(join(root,'packages/sdk/dist/swap/index.js'));
 for(const bps of [0,1,100,2500,9999,10000])for(const cap of [0,1,100,1000000])for(const amount of [0,1,99,100,10001,1000000000]){
  const fee={basisPoints:bps,maximumFee:new BN(cap)};
  for(const fn of ['transferFeeWithheld','transferFeeNetOf','transferFeeGrossFor'])assert.equal(built[fn](fee,new BN(amount)).toString(),original[fn](fee,new BN(amount)).toString(),`${fn}: ${bps}/${cap}/${amount}`);
  for(const fn of ['grossForTransferFee','netOfTransferFee'])assert.equal(builtSwap[fn](fee,new BN(amount)).toString(),originalSwap[fn](fee,new BN(amount)).toString());
 }
});
test('rebuilt bonding-curve quote math matches published across reserves and amounts',()=>{
 const {PublicKey}=require('@solana/web3.js');
 const original=require(join(published,'index.js')), built=require(join(root,'packages/sdk/dist/index.js'));
 const zero=PublicKey.default;
 const globalFor=()=>({initialized:true,authority:zero,feeRecipient:zero,initialVirtualTokenReserves:new BN('1073000000000000'),initialVirtualSolReserves:new BN('30000000000'),initialRealTokenReserves:new BN('793100000000000'),tokenTotalSupply:new BN('1000000000000000'),feeBasisPoints:new BN(95),withdrawAuthority:zero,enableMigrate:true,poolMigrationFee:new BN(0),creatorFeeBasisPoints:new BN(30),feeRecipients:[zero],setCreatorAuthority:zero,adminSetCreatorAuthority:zero,createV2Enabled:true,whitelistPda:zero,reservedFeeRecipient:zero,mayhemModeEnabled:false,reservedFeeRecipients:[],isCashbackEnabled:false,buybackFeeRecipients:[],buybackBasisPoints:new BN(0),initialVirtualQuoteReserves:new BN('30000000000'),whitelistedQuoteMints:[],creatorFeeConfigurable:true,maxConfigurableCreatorFeeBps:new BN(500),holderRewardClaimAuthority:zero,isHolderRewardEnabled:false,maxCurveDepth:2});
 const supply=new BN('1000000000000000');
 const eq=(label,runOriginal,runBuilt)=>{
  const attempt=(run)=>{try{return {value:run().toString()};}catch(error){return {error:`${error.constructor.name}: ${error.message}`};}};
  assert.deepEqual(attempt(runBuilt),attempt(runOriginal),label);
 };
 for(const amount of ['0','1','1000000','1000000000','50000000000','1000000000000','123456789012345']){
  eq(`buy new curve ${amount}`,()=>original.getBuyTokenAmountFromSolAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:null,amount:new BN(amount),quoteMint:zero}),()=>built.getBuyTokenAmountFromSolAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:null,amount:new BN(amount),quoteMint:zero}));
  eq(`inverse buy new curve ${amount}`,()=>original.getBuySolAmountFromTokenAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:null,amount:new BN(amount),quoteMint:zero}),()=>built.getBuySolAmountFromTokenAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:null,amount:new BN(amount),quoteMint:zero}));
 }
 const curve=original.newBondingCurve(globalFor());
 eq('new curve virtual quote reserves',()=>curve.virtualQuoteReserves,()=>built.newBondingCurve(globalFor()).virtualQuoteReserves);
 eq('new curve virtual token reserves',()=>curve.virtualTokenReserves,()=>built.newBondingCurve(globalFor()).virtualTokenReserves);
 for(const scale of [1,2,10]){
  const reserves={virtualQuoteReserves:curve.virtualQuoteReserves.muln(scale),realQuoteReserves:new BN('5000000000')};
  for(const amount of ['1000000','100000000000','700000000000000']){
   eq(`sell ${scale}x ${amount}`,()=>original.getSellSolAmountFromTokenAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:{...curve,...reserves},amount:new BN(amount)}),()=>built.getSellSolAmountFromTokenAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:{...curve,...reserves},amount:new BN(amount)}));
   eq(`buy live curve ${scale}x ${amount}`,()=>original.getBuyTokenAmountFromSolAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:{...curve,...reserves},amount:new BN(amount),quoteMint:zero}),()=>built.getBuyTokenAmountFromSolAmount({global:globalFor(),feeConfig:null,mintSupply:supply,bondingCurve:{...curve,...reserves},amount:new BN(amount),quoteMint:zero}));
  }
 }
 eq('market cap',()=>original.bondingCurveMarketCap({mintSupply:supply,virtualQuoteReserves:curve.virtualQuoteReserves,virtualTokenReserves:curve.virtualTokenReserves}),()=>built.bondingCurveMarketCap({mintSupply:supply,virtualQuoteReserves:curve.virtualQuoteReserves,virtualTokenReserves:curve.virtualTokenReserves}));
 eq('market cap zero token reserves',()=>original.bondingCurveMarketCap({mintSupply:supply,virtualQuoteReserves:new BN(1),virtualTokenReserves:new BN(0)}),()=>built.bondingCurveMarketCap({mintSupply:supply,virtualQuoteReserves:new BN(1),virtualTokenReserves:new BN(0)}));
});
test('rebuilt multi-hop route ends match published across chains and legacy mints',()=>{
 const {PublicKey}=require('@solana/web3.js');
 const {TOKEN_PROGRAM_ID, NATIVE_MINT}=require('@solana/spl-token');
 const original=require(join(published,'index.js')), built=require(join(root,'packages/sdk/dist/index.js'));
 const key=(n)=>new PublicKey(createHash('sha256').update(`pump-sdk-multihop-${n}`).digest());
 const [A,B,C,D]=[key(1),key(2),key(3),key(4)];
 const hop=(base,quote,venue='pool')=>({venue,baseMint:base,quoteMint:quote,baseTokenProgram:TOKEN_PROGRAM_ID,quoteTokenProgram:TOKEN_PROGRAM_ID});
 const ends=(run,hops,side)=>{
  try{
   const {input,output,currency}=run(hops,side);
   return {input:`${input.mint.toBase58()}/${input.tokenProgram.toBase58()}`,output:`${output.mint.toBase58()}/${output.tokenProgram.toBase58()}`,currency:`${currency.mint.toBase58()}/${currency.tokenProgram.toBase58()}`};
  }catch(error){return {error:`${error.constructor.name}: ${error.message}`};}
 };
 const eq=(label,hops,side)=>assert.deepEqual(ends(built.multiHopRouteEnds,hops,side),ends(original.multiHopRouteEnds,hops,side),label);
 // Buy walks the quote chain up (each next hop is quoted in the previous hop's base);
 // sell walks it down. Input/output/currency follow the side, per the function's doc.
 eq('buy one hop',[hop(A,B)],'buy');
 eq('sell one hop',[hop(A,B)],'sell');
 eq('buy three hops',[hop(A,B),hop(C,A),hop(D,C)],'buy');
 eq('sell three hops',[hop(A,B),hop(B,C),hop(C,D)],'sell');
 eq('buy curve venue',[hop(A,B,'curve'),hop(C,A,'curve')],'buy');
 // A legacy SOL quote mint (the zero key curves store, or WSOL itself) reads as
 // WSOL under the SPL token program on both sides of a hop.
 eq('buy legacy zero-key quote',[hop(A,PublicKey.default)],'buy');
 eq('sell legacy WSOL quote',[hop(A,NATIVE_MINT)],'sell');
 eq('buy legacy zero-key base',[hop(PublicKey.default,B),hop(C,PublicKey.default)],'buy');
 eq('empty route',[],'buy');
 eq('empty route sell',[],'sell');
 eq('buy discontinuous chain',[hop(A,B),hop(C,D)],'buy');
 eq('sell discontinuous chain',[hop(A,B),hop(C,D)],'sell');
});
