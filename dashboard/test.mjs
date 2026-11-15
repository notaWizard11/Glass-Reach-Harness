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
 await call('agent',{text:'What should I do?'});session=(await call('session')).body;assert.equal(session.suggestions.length,0,'ordinary inner thoughts no longer create approval clutter');
 await call('agent',{text:'Legacy explicit proposal request',purpose:'suggestions'});session=(await call('session')).body;assert.ok(session.suggestions.length);assert.equal(session.events.length,before+1,'proposals do not execute');
 const q=session.suggestions[0];const approvals=await Promise.all([call('suggestion',{id:q.id}),call('suggestion',{id:q.id})]);assert.equal(approvals.filter(x=>x.body.status==='complete').length,1);assert.equal(approvals.filter(x=>x.status===400).length,1);assert.equal((await call('session')).body.events.length,before+2,'concurrent approvals execute only once');
 await call('agent',{text:'Draw the area',purpose:'atlas'});session=(await call('session')).body;assert.ok(session.maps[0].nodes.length>1);
 await call('settings',{model:'general-test',modelsByPurpose:{chat:'small-test',game:'large-test',prose:'prose-test',atlas:'',suggestions:''}});
 const choices=(await call('session')).body;assert.equal(choices.model,'general-test');assert.equal(choices.modelsByPurpose.chat,'small-test');assert.equal(choices.modelsByPurpose.game,'large-test');assert.equal(choices.modelsByPurpose.prose,'prose-test');
 await call('settings',{masterPrompt:'Keep dialogue verbatim.'});await call('settings',{masterPrompt:'Keep it concise.'});session=(await call('session')).body;assert.ok(session.promptVersions.some(x=>x.text==='Keep dialogue verbatim.'));
 await call('local',{draft:'Do not lose this',notes:[{id:'n',text:'Local only'}]});await call('agent/reset',{});session=(await call('session')).body;assert.equal(session.messages.length,0);assert.equal(session.draft,'Do not lose this');assert.equal(session.notes.length,1);assert.ok(session.sessions.length);
 const second=(await call('profiles',{name:'Second Keeper',entityId:'second'})).body.id;const s2=(await call('session',undefined,second)).body;assert.equal(s2.draft,'');assert.equal(s2.notes.length,0);assert.equal(s2.messages.length,0);assert.equal(s2.state.you.id,'second');
 assert.equal((await call('action',{op:'join',args:{entity:'other'},requestId:'bad'})).status,400);
 assert.equal((await call('action',{op:'join',args:{template:'scout',name:'Overwrite'},requestId:'bad2'})).status,400);
 await call('agent',{text:'Suggest again',purpose:'suggestions'});session=(await call('session')).body;const stale=session.suggestions.find(x=>x.status==='pending');await call('action',{op:'act',args:{verb:'go',target:'road'},requestId:'move'});assert.equal((await call('suggestion',{id:stale.id})).status,400);
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
 c.readied=[{revision:'in-flight',status:'executing'},{revision:'confirmed',status:'executing'},{revision:'waiting',status:'armed'}];
 c.requests['readied-in-flight']={status:'pending'};
 c.requests['readied-confirmed']={status:'complete'};
 await store.save();
 const restored=(await new Store(dir,true).init()).character('aaron');assert.equal(restored.requests.sent.status,'uncertain');assert.equal(restored.suggestions[0].status,'uncertain');assert.equal(restored.suggestions[1].status,'pending');assert.match(restored.agentStatus,/Interrupted/);
 assert.deepEqual(restored.readied.map(rule=>rule.status),['uncertain','complete','armed']);
});

test('older history and export include events beyond the initial window',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-history-')),app=await startServer({demo:true,port:0,dataDir:dir});t.after(()=>app.stop());
 const c=app.store.character('aaron');await app.game.refresh(app.store.profile('aaron'));c.events=Array.from({length:1300},(_,i)=>({seq:i+1,kind:'say',payload:{text:String(i)}}));
 const get=async path=>(await fetch(app.url+'api/'+path,{headers:{'X-Glass-Reach-Dashboard':'1'}})).json();
 assert.equal((await get('session')).events.length,600);const older=await get('history?before=701');assert.equal(older.length,500);assert.equal(older.at(-1).seq,700);assert.equal((await get('export')).events.length,1300);
});

test('live feed polls without browser requests, avoids overlap and honors pause',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-live-')),app=await startServer({demo:true,port:0,dataDir:dir,liveIntervalMs:20});t.after(()=>app.stop());
 const headers={'X-Glass-Reach-Dashboard':'1'};
 const session=await (await fetch(app.url+'api/session',{headers})).json();
 let calls=0,active=0,maxActive=0;
 app.game.refresh=async()=>{calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,45));active--;};
 await new Promise(r=>setTimeout(r,180));
 assert.ok(calls>=2,'server keeps checking with no browser requests');
 assert.equal(maxActive,1,'slow refreshes do not pile up');
 await fetch(app.url+'api/settings',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({profile:session.profile.id,liveFeed:false})});
 await new Promise(r=>setTimeout(r,70));const paused=calls;
 await new Promise(r=>setTimeout(r,90));assert.equal(calls,paused);
});
import {modelForPurpose} from './agent.mjs';
test('interaction models override the general model with account-default fallback',()=>{
 assert.equal(modelForPurpose({model:'general',modelsByPurpose:{chat:'small',game:'large'}},'chat'),'small');
 assert.equal(modelForPurpose({model:'general',modelsByPurpose:{chat:'small',game:'large'}},'game'),'large');
 assert.equal(modelForPurpose({model:'general',modelsByPurpose:{atlas:''}},'atlas'),'general');
 assert.equal(modelForPurpose({model:''},'suggestions'),undefined);
 const settings={model:'general',modelsByPurpose:{chat:'capable',game:'strong',prose:'cheap'}};
 assert.equal(modelForPurpose(settings,'scene-story'),'cheap');
 assert.equal(modelForPurpose(settings,'scene-summary'),'capable');
 assert.equal(modelForPurpose(settings,'recap'),'capable');
 assert.equal(modelForPurpose(settings,'game'),'strong');
 assert.equal(modelForPurpose({...settings,modelsByPurpose:{...settings.modelsByPurpose,autopilot:'pilot-model'}},'autopilot'),'pilot-model');
 assert.equal(modelForPurpose({model:'general',modelsByPurpose:{chat:'capable'}},'scene-story'),'general');
});

test('readied actions edit, disarm and fire once in the background',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-readied-'));
 const app=await startServer({demo:true,port:0,dataDir:dir,liveIntervalMs:25});
 t.after(()=>app.stop());
 const headers={'X-Glass-Reach-Dashboard':'1'};
 const session=await (await fetch(app.url+'api/session',{headers})).json();
 const post=async(path,body)=>fetch(app.url+'api/'+path,{method:'POST',
   headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(body)});
 const arm=async body=>{
   const response=await post('readied',body);
   const payload=await response.json();
   assert.equal(response.status,200,payload.error);
   return payload.readied.find(rule=>rule.id===(body.id||body.approvalId));
 };
 await post('settings',{liveFeed:false});
 const scene={minutes:5,world:session.state.world,entity:session.profile.entityId,location:session.state.here.id};
 const reply={...scene,approvalId:crypto.randomUUID(),trigger:{kind:'reply',person:'sera',phrase:'ready'},op:'say',args:{text:'Old line',to:'sera'}};
 const original=await arm(reply);
 assert.equal((await arm(reply)).revision,original.revision,'a repeated approval does not add a duplicate');
 const edited=await arm({...reply,id:original.id,revision:original.revision,args:{text:'I will meet you there.',to:'sera'}});
 assert.notEqual(edited.revision,original.revision);
 assert.equal((await post('readied',{id:original.id,revision:original.revision,disarm:true})).status,400);
 const arrival=await arm({...scene,approvalId:crypto.randomUUID(),trigger:{kind:'arrival',person:'sera'},op:'act',args:{verb:'drink',target:'skin'}});
 const cancelled=await arm({...scene,approvalId:crypto.randomUUID(),trigger:{kind:'water'},op:'say',args:{text:'Disarmed line'}});
 assert.equal((await post('readied',{id:cancelled.id,revision:cancelled.revision,disarm:true})).status,200);
 const c=app.store.character('aaron');
 c.events.push({seq:10,kind:'say',actor:'sera',payload:{text:'ready for everyone'}});
 await new Promise(r=>setTimeout(r,70));
 assert.equal(c.readied.find(rule=>rule.id===edited.id).status,'armed','a public line is not a direct reply');
 c.events.push({seq:11,kind:'say',actor:'sera',target:scene.entity,payload:{text:'I am ready.'}});
 c.events.push({seq:12,kind:'moved',actor:'sera',target:'sera',payload:{from:'road',to:scene.location}});
 for(let i=0;i<100&&c.readied.find(rule=>rule.id===arrival.id).status!=='complete';i++)await new Promise(r=>setTimeout(r,10));
 await new Promise(r=>setTimeout(r,70));
 assert.deepEqual(c.readied.map(rule=>rule.status),['complete','complete','cancelled']);
 assert.equal(c.events.filter(event=>event.payload?.text==='I will meet you there.').length,1);
 assert.equal(c.events.filter(event=>event.kind==='drank'&&event.seq>12).length,1);
 assert.equal(c.messages.filter(m=>m.text.startsWith('Readied action · complete')).length,2);
});

test('Atlas scene images save and are scoped to their character',async t=>{
 const previousKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='fixture-key';
 t.after(()=>{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;});
 const dir=await mkdtemp(join(tmpdir(),'glass-reach-scene-'));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPWQAAAAASUVORK5CYII=','base64');
 const app=await startServer({dataDir:dir,port:0, imageGenerator:async({description,observation})=>{
   assert.equal(description,'North arch');
   assert.equal(observation.here.name,'The Gate Yard');
   return png;
 }});
 t.after(()=>app.stop());
 const profile=app.store.profile('aaron');
 profile.entityId='demo-keeper';
 app.store.character(profile.id).state=await app.game.demoState(profile);
 app.store.data.profiles.push({...profile,id:'other',entityId:'other'});
 const headers={'X-Glass-Reach-Dashboard':'1'};
 const session=await (await fetch(app.url+'api/session',{headers})).json();
 assert.equal(session.sceneImageEnabled,true);
 assert.ok(session.liveNextAt>=session.serverTime);
 const response=await fetch(app.url+'api/scene-image',{
   method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},
   body:JSON.stringify({description:'North arch'}),
 });
 assert.equal(response.status,201);
 const scene=await response.json();
 const saved=await fetch(app.url+'api/scene-image?profile=aaron&id='+scene.id,{headers});
 assert.equal(saved.headers.get('content-type'),'image/png');
 assert.deepEqual(Buffer.from(await saved.arrayBuffer()),png);
 const other=await fetch(app.url+'api/scene-image?profile=other&id='+scene.id,{headers});
 assert.equal(other.status,404);
 const ledger=JSON.parse(await readFile(join(dir,'ledger.json'),'utf8'));
 assert.deepEqual(ledger.characters.aaron.sceneImages,[scene]);
});
