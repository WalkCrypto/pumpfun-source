import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const entry=(rank,walletAddress)=>({rank,walletAddress,username:null,userId:null,xUsername:null,isVerified:false,verifiedBadgeVisible:false,pnlUsd:1,pnlPercent:1,realizedPnlUsd:1,unrealizedPnlUsd:0,buySpendSol:1,positionsCount:1,lastRefreshedAtMs:0});
const response=(entries)=>({ok:true,source,data:{kind:'traders',entries,periodLabel:'Daily',windowStartSec:1700000000}});
test('trader domain responses reject a wallet appearing twice on one board',()=>{
  assert.throws(()=>parseLeaderboardResponse(response([entry(1,'wallet-a'),entry(2,'wallet-a')])),/invalid response/);
});
test('trader domain responses still accept distinct wallets',()=>{
  assert.doesNotThrow(()=>parseLeaderboardResponse(response([entry(1,'wallet-a'),entry(2,'wallet-b')])));
});
