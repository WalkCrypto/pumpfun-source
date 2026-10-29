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
test('rebuilt token-incentive accrual matches published across day boundaries',()=>{
 const {PublicKey}=require('@solana/web3.js');
 const original=require(join(published,'index.js')), built=require(join(root,'packages/sdk/dist/index.js'));
 const zero=PublicKey.default;
 const DAY=86400, START=1000000;
 const globalFor=(overrides={})=>({startTime:new BN(START),endTime:new BN(START+10*DAY),secondsInADay:new BN(DAY),mint:zero,totalTokenSupply:[1000,2000,3000,4000,5000,6000,7000,8000,9000,10000,11000].map(n=>new BN(n)),solVolumes:[100,200,300,400,500,600,700,800,900,1000,1100].map(n=>new BN(n)),...overrides});
 const userFor=(overrides={})=>({user:zero,needsClaim:false,totalUnclaimedTokens:new BN(500),totalClaimedTokens:new BN(0),currentSolVolume:new BN(50),lastUpdateTimestamp:new BN(START+DAY),hasTotalClaimedTokens:false,cashbackEarned:new BN(0),totalCashbackClaimed:new BN(0),stableCashbackEarned:new BN(0),totalStableCashbackClaimed:new BN(0),...overrides});
 const eq=(label,runOriginal,runBuilt)=>{
  const attempt=(run)=>{try{return {value:run().toString()};}catch(error){return {error:`${error.constructor.name}: ${error.message}`};}};
  assert.deepEqual(attempt(runBuilt),attempt(runOriginal),label);
 };
 const at=(days,extra=0)=>START+days*DAY+extra;
 // Day 2, last updated day 1: unclaimed accrues day 1 (50*2000/200 = 500 on top
 // of 500); current-day tokens are 0 because the current day is not the updated day.
 eq('unclaimed accrues past day',()=>original.totalUnclaimedTokens(globalFor(),userFor(),at(2,3600)),()=>built.totalUnclaimedTokens(globalFor(),userFor(),at(2,3600)));
 eq('current day zero when days differ',()=>original.currentDayTokens(globalFor(),userFor(),at(2,3600)),()=>built.currentDayTokens(globalFor(),userFor(),at(2,3600)));
 // Same day as the last update: current-day tokens accrue, unclaimed is unchanged.
 eq('current day accrues same day',()=>original.currentDayTokens(globalFor(),userFor(),at(1,3600)),()=>built.currentDayTokens(globalFor(),userFor(),at(1,3600)));
 eq('unclaimed unchanged same day',()=>original.totalUnclaimedTokens(globalFor(),userFor(),at(1,3600)),()=>built.totalUnclaimedTokens(globalFor(),userFor(),at(1,3600)));
 // Zero-volume updated day: no accrual either way.
 const zeroVolume=globalFor({solVolumes:[100,0,300,400,500,600,700,800,900,1000,1100].map(n=>new BN(n))});
 eq('unclaimed unchanged zero volume',()=>original.totalUnclaimedTokens(zeroVolume,userFor(),at(2,3600)),()=>built.totalUnclaimedTokens(zeroVolume,userFor(),at(2,3600)));
 eq('current day zero zero volume',()=>original.currentDayTokens(zeroVolume,userFor(),at(1,3600)),()=>built.currentDayTokens(zeroVolume,userFor(),at(1,3600)));
 // Degenerate schedules and out-of-window timestamps.
 eq('unclaimed zero start',()=>original.totalUnclaimedTokens(globalFor({startTime:new BN(0)}),userFor(),at(2)),()=>built.totalUnclaimedTokens(globalFor({startTime:new BN(0)}),userFor(),at(2)));
 eq('current day zero start',()=>original.currentDayTokens(globalFor({startTime:new BN(0)}),userFor(),at(2)),()=>built.currentDayTokens(globalFor({startTime:new BN(0)}),userFor(),at(2)));
 eq('unclaimed before start',()=>original.totalUnclaimedTokens(globalFor(),userFor(),START-1),()=>built.totalUnclaimedTokens(globalFor(),userFor(),START-1));
 eq('current day before start',()=>original.currentDayTokens(globalFor(),userFor(),START-1),()=>built.currentDayTokens(globalFor(),userFor(),START-1));
 eq('current day after end',()=>original.currentDayTokens(globalFor(),userFor(),at(11)),()=>built.currentDayTokens(globalFor(),userFor(),at(11)));
 eq('unclaimed end before start',()=>original.totalUnclaimedTokens(globalFor({endTime:new BN(START-DAY)}),userFor(),at(2)),()=>built.totalUnclaimedTokens(globalFor({endTime:new BN(START-DAY)}),userFor(),at(2)));
 eq('unclaimed stale update',()=>original.totalUnclaimedTokens(globalFor(),userFor({lastUpdateTimestamp:new BN(START-1)}),at(2)),()=>built.totalUnclaimedTokens(globalFor(),userFor({lastUpdateTimestamp:new BN(START-1)}),at(2)));
});
