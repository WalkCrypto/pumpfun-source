import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const entry=(rank,userId)=>({rank,userId,username:null,walletAddress:null,wallets:['w'],isVerified:false,verifiedBadgeVisible:false,totalPaidUsdc:1,payoutCount:1,lastPaidAt:null});
const response=(entries)=>({ok:true,source,data:{kind:'creators',entries,totalEarners:entries.length,generatedAt:null,page:1,pageSize:20}});
test('creator domain responses reject a userId appearing twice on one board',()=>{
  assert.throws(()=>parseLeaderboardResponse(response([entry(1,'user-a'),entry(2,'user-a')])),/invalid response/);
});
test('creator domain responses still accept distinct and null userIds',()=>{
  assert.doesNotThrow(()=>parseLeaderboardResponse(response([entry(1,'user-a'),entry(2,'user-b'),entry(3,null),entry(4,null)])));
});
