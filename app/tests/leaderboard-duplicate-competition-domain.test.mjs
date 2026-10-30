import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeaderboardResponse} from '../packages/frontend/src/app/leaderboard/types.ts';
const source={mode:'developer-api',label:'Pump developer API',fetchedAt:'2026-10-29T00:00:00Z'};
const summary=(id,phase)=>({id,slug:id,kind:'group',title:'Synthetic',description:'Offline fixture',prizeCopy:'',prizes:[],minMembers:1,maxMembers:5,registrationOpensAt:null,registrationClosesAt:null,startsAt:null,endsAt:null,maxEntries:1,entriesCount:0,participants:0,joinable:false,phase,isFinal:false});
const response=(upcoming,live,past)=>({ok:true,source,data:{kind:'competitions',upcoming,live,past}});
test('competition domain responses reject an id repeated across buckets',()=>{
  assert.throws(()=>parseLeaderboardResponse(response([summary('c1','upcoming')],[summary('c1','live')],[])),/invalid response/);
  assert.throws(()=>parseLeaderboardResponse(response([summary('c1','upcoming'),summary('c1','upcoming')],[],[])),/invalid response/);
});
test('competition domain responses still accept distinct ids',()=>{
  assert.doesNotThrow(()=>parseLeaderboardResponse(response([summary('c1','upcoming')],[summary('c2','live')],[summary('c3','ended')])));
});
