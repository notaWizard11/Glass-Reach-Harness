import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyRecords,recordPermissions,captureDocuments} from './journal.mjs';
import {startServer} from './server.mjs';
test('only explicit local save requests authorize records',()=>{
 assert.deepEqual(recordPermissions('I think I add this to my quests'),['quest']);
 assert.deepEqual(recordPermissions('Save what just happened in memories'),['memory']);
 assert.deepEqual(recordPermissions('Should I add this to my quests?'),[]);
 assert.deepEqual(recordPermissions('Do not save this in memories'),[]);
 const c={events:[{seq:2}]};const record={kind:'quest',title:'Find the keeper',text:'He vanished.',sourceSeqs:[2,999]};
 assert.equal(applyRecords(c,[record]).length,0);
 applyRecords(c,[record],{allowed:['quest'],automatic:true});assert.deepEqual(c.quests[0].sources,[2]);
 c.quests[0].status='completed';applyRecords(c,[record],{allowed:['quest'],automatic:true});
 assert.equal(c.quests.length,1);assert.equal(c.quests[0].status,'completed');
 assert.equal(applyRecords(c,[{...record,title:'Invented',sourceSeqs:[999]}],{allowed:['quest'],automatic:true}).length,0);
});
test('document copies survive loss of possession and preserve changed versions',()=>{
 const c={state:{here:{name:'Yard'},cursor:5}};
 captureDocuments(c,[{id:'letter',name:'Letter',state:{text:'Meet at dusk.'}}]);
 captureDocuments(c,[]);assert.equal(c.documents[0].text,'Meet at dusk.');
 captureDocuments(c,[{id:'letter',name:'Letter',state:{text:'Meet at dawn.'}}]);
 assert.equal(c.documents.length,1);assert.equal(c.documents[0].versions[0].text,'Meet at dusk.');
});
test('quest discovery and conversational saves stay local, survive session reset and isolate characters',async t=>{
 const app=await startServer({demo:true,port:0,dataDir:await mkdtemp(join(tmpdir(),'gr-journal-'))});t.after(()=>app.stop());let csrf;
 const call=async(path,body)=>{const r=await fetch(app.url+'api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Glass-Reach-Dashboard':'1','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});return r.json();};
 csrf=(await call('session')).csrf;const c=app.store.character('aaron');const before=c.events.length;
 const idle=async()=>{for(let i=0;i<100&&c.agentStatus==='working';i++)await new Promise(r=>setTimeout(r,10));assert.equal(c.agentStatus,'idle');};
 await call('agent',{purpose:'quests',text:'Discover quests'});await idle();assert.equal(c.quests.length,1);assert.equal(c.quests[0].status,'discovered');
 await call('agent',{text:'Add finding water to my quests',mode:'chat'});await idle();assert.equal(c.quests.length,2);
 await call('agent',{text:'Save what just happened in my memories',mode:'chat'});await idle();assert.equal(c.journalMemories.length,1);assert.match(c.messages.at(-1).text,/Saved locally/);
 assert.equal(c.events.length,before);assert.equal(c.suggestions.length,0);
 await call('agent/reset',{});assert.equal(c.quests.length,2);assert.equal(c.journalMemories.length,1);
 const second=await call('profiles',{name:'Another',entityId:'another'});assert.equal(app.store.character(second.id).quests,undefined);
 assert.ok(c.documents.length);
});
