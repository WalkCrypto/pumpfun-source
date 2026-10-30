import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const summary=(prizes)=>({id:'synthetic',slug:'synthetic',kind:'group',title:'Synthetic',description:'Offline fixture',prizeCopy:'',prizes,minMembers:1,maxMembers:5,registrationOpensAt:null,registrationClosesAt:null,startsAt:null,endsAt:null,maxEntries:1,entriesCount:0,participants:0,joinable:false,phase:'live',isFinal:false});
const entry=()=>({entryId:'e',participantId:'p',kind:'person',rank:1,pnlUsd:-1,realizedPnlUsd:-1,unrealizedPnlUsd:0,memberCount:1,membersFresh:1,struck:false,lastRefreshedAtMs:0,walletAddress:null,username:null,isVerified:false,verifiedBadgeVisible:false});
const response=(prizes)=>({ok:true,source,data:{kind:'competition-detail',competition:summary(prizes),entries:[entry()],totalRanked:1,builtAtMs:0,isFinal:false}});
test('competition domain responses reject zero, reversed, and out-of-order prize ranges',()=>{
  for(const prizes of [[{rankFrom:0,rankTo:1,amount:'1000'}],[{rankFrom:1,rankTo:0,amount:'1000'}],[{rankFrom:0,rankTo:0,amount:'1000'}],[{rankFrom:5,rankTo:1,amount:'1000'}],[{rankFrom:3,rankTo:2,amount:'1000'}]]) {
    assert.throws(()=>parseLeaderboardResponse(response(prizes)),/invalid response/);
  }
});
test('competition domain responses still accept valid 1-based prize ranges',()=>{
  assert.doesNotThrow(()=>parseLeaderboardResponse(response([{rankFrom:1,rankTo:1,amount:'1000'},{rankFrom:3,rankTo:5,amount:'2 SOL'}])));
  assert.doesNotThrow(()=>parseLeaderboardResponse(response([])));
});
