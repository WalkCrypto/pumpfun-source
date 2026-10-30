import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const summary=(overrides)=>({id:'synthetic',slug:'synthetic',kind:'group',title:'Synthetic',description:'Offline fixture',prizeCopy:'',prizes:[],minMembers:1,maxMembers:5,registrationOpensAt:'2026-10-20T00:00:00Z',registrationClosesAt:'2026-10-25T00:00:00Z',startsAt:'2026-10-29T00:00:00Z',endsAt:'2026-10-30T00:00:00Z',maxEntries:1,entriesCount:0,participants:0,joinable:false,phase:'live',isFinal:false,...overrides});
const entry=()=>({entryId:'e',participantId:'p',kind:'person',rank:1,pnlUsd:-1,realizedPnlUsd:-1,unrealizedPnlUsd:0,memberCount:1,membersFresh:1,struck:false,lastRefreshedAtMs:0,walletAddress:null,username:null,isVerified:false,verifiedBadgeVisible:false});
const response=(overrides)=>({ok:true,source,data:{kind:'competition-detail',competition:summary(overrides),entries:[entry()],totalRanked:1,builtAtMs:0,isFinal:false}});
test('competition domain responses reject windows that end before they start',()=>{
  for(const overrides of [{registrationOpensAt:'2026-10-25T00:00:00Z',registrationClosesAt:'2026-10-20T00:00:00Z'},{startsAt:'2026-10-30T00:00:00Z',endsAt:'2026-10-29T00:00:00Z'}]) {
    assert.throws(()=>parseLeaderboardResponse(response(overrides)),/invalid response/);
  }
});
test('competition domain responses still accept ordered, equal, open-ended, and offset windows',()=>{
  for(const overrides of [{},{startsAt:'2026-10-30T00:00:00Z',endsAt:'2026-10-30T00:00:00Z'},{registrationOpensAt:null,registrationClosesAt:null},{startsAt:'2026-10-30T00:00:00+05:00',endsAt:'2026-10-29T20:00:00Z'}]) {
    assert.doesNotThrow(()=>parseLeaderboardResponse(response(overrides)));
  }
});
