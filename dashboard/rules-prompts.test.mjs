import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncRules,rulesContext} from './rules-feed.mjs';
import {promptFor,promptRevision,savePrompt,buildContext,composeInstructions} from './prompts.mjs';
import {startServer} from './server.mjs';
import {Store} from './store.mjs';

test('rules pages persist in order, recover after failure and distinguish seen from downloaded',async()=>{
 const c={state:{world:'test',rules_version:42}};let saved=0,fail=true;
 const read=async(op,args)=>{assert.equal(op,'guide');if(args.since===0)return {topic:'changes',version:42,text:"v1 to v40\nmore: guide('changes', since=40)"};if(fail)throw new Error('Offline');return {topic:'changes',version:42,text:'v41: Sheet is opt-in. v42: Changed watches.'};};
 await syncRules(c,read,async()=>{saved++;});assert.equal(c.rulesFeed.version,40);assert.equal(c.rulesFeed.seenVersion,0);assert.match(c.rulesFeed.error,/Offline/);
 fail=false;await syncRules(c,read,async()=>{saved++;},{force:true});assert.equal(c.rulesFeed.version,42);assert.equal(c.rulesFeed.pages.length,2);assert.equal(c.rulesFeed.error,undefined);assert.match(rulesContext(c),/Sheet is opt-in/);
 let reads=0;await syncRules(c,async()=>{reads++;},async()=>{},{now:Date.now()+120000});assert.equal(reads,0);assert.ok(saved>=3);
});
test('editable prompts change real context, protect mandatory state, reject stale updates and preserve history',()=>{
 const data={masterPrompt:'My voice'},profile={name:'Test',instructions:'Be concise'},c={state:{you:{state:{body:2}}},events:[{seq:1,kind:'say',payload:{text:'Hello'}}],messages:[{role:'user',text:'hello'}],notes:['private'],quests:[]};
 const before=promptFor(data,'chat'),revision=promptRevision(data,'chat');
 savePrompt(data,'chat',{...before,instructions:'Think in short questions.',context:{...before.context,recentEvents:0,conversation:0,notes:false}},revision);
 const context=buildContext(data,profile,c,'chat','What now?');assert.deepEqual(context.recentEvents,[]);assert.deepEqual(context.conversation,[]);assert.equal(context.notes,undefined);assert.equal(context.observation,c.state);assert.ok(context.rules);assert.equal(context.characterMechanics.hasSheet,false);
 assert.match(composeInstructions(data,profile,c,'chat'),/Think in short questions/);assert.match(composeInstructions(data,profile,c,'chat'),/Chat never dispatches/);assert.equal(data.promptEdits[0].value.instructions,before.instructions);
 assert.throws(()=>savePrompt(data,'chat',before,revision),/changed/);
 const evidence=buildContext(data,profile,c,'recap','Brief me',undefined,'[#1] Record');assert.equal(evidence.evidence,'[#1] Record');assert.equal(evidence.observation,undefined);assert.ok(evidence.rules);
});
test('rules review proposals require explicit application and reject stale prompt revisions',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gr-rules-'));const app=await startServer({demo:true,port:0,dataDir:dir});t.after(()=>app.stop());let csrf;
 const call=async(path,body)=>{const r=await fetch(app.url+'api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Glass-Reach-Dashboard':'1','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 csrf=(await call('session')).data.csrf;await call('rules/sync',{});const c=app.store.character('aaron');assert.equal(c.rulesFeed.version,1);
 const prompts=(await call('prompts')).data;assert.equal(prompts.entries.length,9);
 await call('rules/review',{});for(let i=0;i<100&&c.rulesReview.status==='working';i++)await new Promise(r=>setTimeout(r,10));assert.equal(c.rulesReview.status,'complete');assert.equal(app.store.data.promptOverrides,undefined);
 const original=promptFor(app.store.data,'chat');c.rulesReview.proposals=[{id:'p',key:'chat',revision:promptRevision(app.store.data,'chat'),before:original,instructions:'Use concise reflection.',task:'',status:'pending'}];
 await app.store.save();assert.equal((await call('rules/proposal',{id:'p'})).status,200);assert.equal(promptFor(app.store.data,'chat').instructions,'Use concise reflection.');assert.equal((await call('rules/proposal',{id:'p'})).status,400);
 c.rulesReview.proposals=[{id:'stale',key:'chat',revision:prompts.entries.find(p=>p.key==='chat').revision,before:original,instructions:'Old text',task:'',status:'pending'}];assert.equal((await call('rules/proposal',{id:'stale'})).status,400);
 const restored=await new Store(dir,true).init();assert.equal(promptFor(restored.data,'chat').instructions,'Use concise reflection.');assert.equal(restored.character('aaron').rulesFeed.version,1);
});
