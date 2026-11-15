import test from 'node:test';
import assert from 'node:assert/strict';
import {storyRows,groupStoryRows} from './timeline.mjs';

test('scene rails preserve archive boundaries after filtering and include anchored player messages',()=>{
 const scenes=[{id:'a',start:10,end:19,title:'Yard'},{id:'b',start:20,end:30,title:'Hold'}];
 const rows=storyRows([{seq:11,kind:'say'},{seq:22,kind:'say'}],[{role:'user',mode:'game',timelineSeq:21,text:'Ask the guard'}]).reverse();
 const grouped=groupStoryRows(rows,scenes);
 assert.deepEqual(grouped.map(g=>g.key),['b','a']);
 assert.equal(grouped[0].rows.length,2);
 assert.equal(groupStoryRows(rows.filter(r=>r.message),scenes)[0].key,'b');
 assert.equal(groupStoryRows([{order:1}],scenes)[0].key,'unplaced');
});
test('merges player intent, game evidence and narrated outcome in order',()=>{
 const rows=storyRows([{seq:11,kind:'act'},{seq:12,kind:'arrived'},{seq:13,kind:'scene',payload:{text:'The gate opens.'}},{seq:14,kind:'say',payload:{text:'Welcome.'}}],[{id:'u',role:'user',mode:'game',timelineSeq:10,text:'Enter the yard.'},{id:'a',role:'assistant',mode:'game',timelineSeq:14,text:'You step into the yard.'}]);
 assert.deepEqual(rows.map(r=>r.category),['player','action','movement','description','say','result']);
});
test('inner questions and legacy replies stay distinct from game narration',()=>{
 const rows=storyRows([],[{role:'user',mode:'chat',text:'What are my options?'},{role:'assistant',text:'I could ask the guard.'},{role:'error',text:'Disconnected'}]);
 assert.deepEqual(rows.map(r=>r.category),['thought','thought','error']);
});
