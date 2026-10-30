import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const summary=(minMembers,maxMembers)=>({id:'synthetic',slug:'synthetic',kind:'group',title:'Synthetic',description:'Offline fixture',prizeCopy:'',prizes:[],minMembers,maxMembers,registrationOpensAt:null,registrationClosesAt:null,startsAt:null,endsAt:null,maxEntries:1,entriesCount:0,participants:0,joinable:false,phase:'live',isFinal:false});
const entry=()=>({entryId:'e',participantId:'p',kind:'person',rank:1,pnlUsd:-1,realizedPnlUsd:-1,unrealizedPnlUsd:0,memberCount:1,membersFresh:1,struck:false,lastRefreshedAtMs:0,walletAddress:null,username:null,isVerified:false,verifiedBadgeVisible:false});
const response=(minMembers,maxMembers)=>({ok:true,source,data:{kind:'competition-detail',competition:summary(minMembers,maxMembers),entries:[entry()],totalRanked:1,builtAtMs:0,isFinal:false}});
test('competition domain responses reject reversed member bounds',()=>{
  for(const [minMembers,maxMembers] of [[5,3],[2,1],[10,0]]) {
    assert.throws(()=>parseLeaderboardResponse(response(minMembers,maxMembers)),/invalid response/);
  }
});
test('competition domain responses still accept equal and ordered member bounds',()=>{
  for(const [minMembers,maxMembers] of [[1,1],[1,5],[0,0]]) {
    assert.doesNotThrow(()=>parseLeaderboardResponse(response(minMembers,maxMembers)));
  }
});
