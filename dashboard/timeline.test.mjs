import test from 'node:test';
import assert from 'node:assert/strict';
import {storyRows} from './timeline.mjs';
test('merges player intent, game evidence and narrated outcome in order',()=>{
 const rows=storyRows([{seq:11,kind:'act'},{seq:12,kind:'arrived'},{seq:13,kind:'scene',payload:{text:'The gate opens.'}},{seq:14,kind:'say',payload:{text:'Welcome.'}}],[{id:'u',role:'user',mode:'game',timelineSeq:10,text:'Enter the yard.'},{id:'a',role:'assistant',mode:'game',timelineSeq:14,text:'You step into the yard.'}]);
 assert.deepEqual(rows.map(r=>r.category),['player','action','movement','description','say','result']);
});
test('inner questions and legacy replies stay distinct from game narration',()=>{
 const rows=storyRows([],[{role:'user',mode:'chat',text:'What are my options?'},{role:'assistant',text:'I could ask the guard.'},{role:'error',text:'Disconnected'}]);
 assert.deepEqual(rows.map(r=>r.category),['thought','thought','error']);
});
