import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './server.mjs';
import { ingest, Store } from './store.mjs';
import { validateOperation } from './game.mjs';

test('full event history, changed references, and observed graph are retained',async()=>{
 const c={events:[],state:null},raw=JSON.parse(await readFile(new URL('fixture.json',import.meta.url)));
 const batch=Array.from({length:620},(_,i)=>({seq:100+i,kind:'found',payload:{thing:'note'}}));
 ingest(c,raw,batch);assert.equal(c.events.length,629);assert.equal(c.historyCursor,719);assert.equal(c.state.edges.length,4);
 ingest(c,{...raw,goals:[{id:'new',text:'Changed in the same room'}]},batch);assert.equal(c.events.length,629);assert.equal(c.state.goals[0].id,'new');
});
test('unsafe or foreign operation fields are rejected',()=>{assert.throws(()=>validateOperation('act_as',{}));assert.throws(()=>validateOperation('act',{verb:'go',principal:'other'}));assert.throws(()=>validateOperation('remember',{text:'x',entity:'other'}));assert.doesNotThrow(()=>validateOperation('act',{verb:'give',target:'sera',params:{item:'skin'}}));});
test('demo integration: origins, persistence, actions, atlas, proposals and profiles',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-test-')),app=await startServer({demo:true,port:0,dataDir:dir});t.after(()=>app.stop());
 let csrf;const call=async(path,b,profile='aaron')=>{const r=await fetch(app.url+'api/'+path+(b===undefined?'?profile='+profile:''),{method:b===undefined?'GET':'POST',headers:{'X-Glass-Reach-Dashboard':'1',...(b===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:b===undefined?undefined:JSON.stringify({...b,profile})});return {status:r.status,body:await r.json()};};
 let session=(await call('session')).body;csrf=session.csrf;assert.equal(session.demo,true);assert.equal(session.state.you.name,'Demo Keeper');
 assert.equal((await fetch(app.url+'api/session')).status,403);
 assert.equal((await fetch(app.url+'api/settings',{method:'POST',headers:{'X-Glass-Reach-Dashboard':'1'}})).status,403);
 assert.equal((await fetch(app.url,{headers:{Origin:'https://malicious.example'}})).status,403);
 const before=session.events.length;
 const action={op:'say',args:{text:'An exact test line <script>alert(1)</script>'},requestId:'one-action'};
 assert.equal((await call('action',action)).body.status,'complete');await call('action',action);
 session=(await call('session')).body;assert.equal(session.events.length,before+1);assert.equal(session.events.at(-1).payload.text,action.args.text);
 await call('agent',{text:'What should I do?'});session=(await call('session')).body;assert.ok(session.suggestions.length);assert.equal(session.events.length,before+1,'proposals do not execute');
 const q=session.suggestions[0];const approvals=await Promise.all([call('suggestion',{id:q.id}),call('suggestion',{id:q.id})]);assert.equal(approvals.filter(x=>x.body.status==='complete').length,1);assert.equal(approvals.filter(x=>x.status===400).length,1);assert.equal((await call('session')).body.events.length,before+2,'concurrent approvals execute only once');
 await call('agent',{text:'Draw the area',purpose:'atlas'});session=(await call('session')).body;assert.ok(session.maps[0].nodes.length>1);
 await call('settings',{masterPrompt:'Keep dialogue verbatim.'});await call('settings',{masterPrompt:'Keep it concise.'});session=(await call('session')).body;assert.ok(session.promptVersions.some(x=>x.text==='Keep dialogue verbatim.'));
 await call('local',{draft:'Do not lose this',notes:[{id:'n',text:'Local only'}]});await call('agent/reset',{});session=(await call('session')).body;assert.equal(session.messages.length,0);assert.equal(session.draft,'Do not lose this');assert.equal(session.notes.length,1);assert.ok(session.sessions.length);
 const second=(await call('profiles',{name:'Second Keeper',entityId:'second'})).body.id;const s2=(await call('session',undefined,second)).body;assert.equal(s2.draft,'');assert.equal(s2.notes.length,0);assert.equal(s2.messages.length,0);assert.equal(s2.state.you.id,'second');
 assert.equal((await call('action',{op:'join',args:{entity:'other'},requestId:'bad'})).status,400);
 assert.equal((await call('action',{op:'join',args:{template:'scout',name:'Overwrite'},requestId:'bad2'})).status,400);
 await call('agent',{text:'Suggest again'});session=(await call('session')).body;const stale=session.suggestions.find(x=>x.status==='pending');await call('action',{op:'act',args:{verb:'go',target:'road'},requestId:'move'});assert.equal((await call('suggestion',{id:stale.id})).status,400);
 const stored=await new Store(dir,true).init();assert.equal(stored.character('aaron').draft,'Do not lose this');assert.equal(stored.character(second).messages.length,0);
 const eventCount=(await call('session')).body.events.length;
 await call('agent',{text:'Discuss the next step only.',mode:'chat'});
 for(let i=0;i<100;i++){session=(await call('session')).body;if(session.agentStatus!=='working')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(session.events.length,eventCount,'Talk to Codex never executes');
 await call('agent',{text:'A fictional spoken line',mode:'game'});
 for(let i=0;i<100;i++){session=(await call('session')).body;if(session.agentStatus!=='working')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(session.agentStatus,'idle');assert.equal(session.events.length,eventCount+1,'Act in game executes without proposal approval');assert.equal(session.messages.at(-1).mode,'game');
});

test('restart preserves uncertain delivery without retrying',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-restart-')),store=await new Store(dir,true).init(),c=store.character('aaron');
 c.requests.sent={status:'pending'};c.agentStatus='working';c.suggestions=[{id:'sent',status:'executing'},{id:'review',status:'reviewing'}];await store.save();
 const restored=(await new Store(dir,true).init()).character('aaron');assert.equal(restored.requests.sent.status,'uncertain');assert.equal(restored.suggestions[0].status,'uncertain');assert.equal(restored.suggestions[1].status,'pending');assert.match(restored.agentStatus,/Interrupted/);
});

test('older history and export include events beyond the initial window',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-history-')),app=await startServer({demo:true,port:0,dataDir:dir});t.after(()=>app.stop());
 const c=app.store.character('aaron');await app.game.refresh(app.store.profile('aaron'));c.events=Array.from({length:1300},(_,i)=>({seq:i+1,kind:'say',payload:{text:String(i)}}));
 const get=async path=>(await fetch(app.url+'api/'+path,{headers:{'X-Glass-Reach-Dashboard':'1'}})).json();
 assert.equal((await get('session')).events.length,600);const older=await get('history?before=701');assert.equal(older.length,500);assert.equal(older.at(-1).seq,700);assert.equal((await get('export')).events.length,1300);
});
