import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {autopilotConfig,startAutopilot,authorizeAutopilot,pauseAutopilotState,runAutopilot} from './autopilot.mjs';
import {startServer} from './server.mjs';
import {Store} from './store.mjs';
import {Game} from './game.mjs';
const profile={id:'test',entityId:'me',credential:'one'};
function fixture(permissions){
 const c={events:[],messages:[],state:{connection:'Live',world:'w',t:1000,you:{id:'me',state:{hp:6}},here:{id:'yard'},present:[{id:'foe',state:{hp:6}}],holding:[],exits:[{to:'road'}],affordances:[{verb:'go',target:'road'},{verb:'attack',target:'foe'},{verb:'kill',target:'foe'},{verb:'read',target:'book'},{verb:'follow',target:'foe'}]}};
 c.autopilot=startAutopilot(c,profile,autopilotConfig({prompt:'Protect the yard.',permissions}),1000);return c;
}
const check=(c,op,args)=>authorizeAutopilot({character:c,profile,revision:c.autopilot.revision,op,args,current:c.state,now:2000});
test('permissions deny cross-category commands, unsupported verbs and foreign operations',()=>{
 const c=fixture({talk:true});assert.doesNotThrow(()=>check(c,'say',{text:'Hello'}));
 for(const [op,args]of [['act',{verb:'go',target:'road'}],['act',{verb:'attack',target:'foe'}],['act',{verb:'read',target:'book'}],['remember',{text:'x'}],['away',{}],['say',{text:'x',reach:2}]])assert.throws(()=>check(c,op,args));
 c.autopilot.config.permissions={attack:true,travel:true,interact:true};
 assert.throws(()=>check(c,'act',{verb:'kill',target:'foe'}));assert.throws(()=>check(c,'act',{verb:'follow',target:'foe'}));
 c.autopilot.config.locations=['yard'];assert.throws(()=>check(c,'act',{verb:'go',target:'road'}));
 assert.throws(()=>autopilotConfig({prompt:'x',permissions:{talk:true},maxActions:0}));
});
test('self-defence needs a fresh targeted attack after activation, not speech or old threats',()=>{
 const c=fixture({selfDefence:true});const action={verb:'attack',target:'foe'};
 c.events=[{seq:1,t:999,kind:'say',actor:'foe',target:'me',payload:{text:'I will attack'}}];assert.throws(()=>check(c,'act',action));
 c.events.push({seq:2,t:999,kind:'hit',actor:'foe',target:'someone-else'});assert.throws(()=>check(c,'act',action));
 c.events.push({seq:3,t:999,kind:'hit',actor:'foe',target:'me'});assert.doesNotThrow(()=>check(c,'act',action));
 c.state.present[0].state.yielded_to='me';assert.throws(()=>check(c,'act',action));delete c.state.present[0].state.yielded_to;
 c.state.t=2000;assert.throws(()=>check(c,'act',action));
});
test('pause during model work prevents dispatch and action budget stops future steps',async()=>{
 const c=fixture({talk:true});let resolvePlan,entered;const ready=new Promise(r=>entered=r);let sent=0;
 const deps={profile,character:c,game:{refresh:async()=>{}},save:async()=>{},now:()=>2000,execute:async()=>{sent++;return {status:'complete'};}};
 const run=runAutopilot({...deps,plan:()=>{entered();return new Promise(r=>resolvePlan=r);}});await ready;pauseAutopilotState(c,'manual');resolvePlan({suggestions:[{op:'say',argumentsJson:'{"text":"hello"}'}]});await run;assert.equal(sent,0);
 c.autopilot=startAutopilot(c,profile,autopilotConfig({prompt:'x',permissions:{talk:true},maxActions:1}),1000);
 await runAutopilot({...deps,plan:async()=>({suggestions:[{op:'say',title:'Greet',argumentsJson:'{"text":"hello"}'}]})});assert.equal(sent,1);
 c.autopilot.nextAt=0;await runAutopilot({...deps,plan:async()=>{throw new Error('should not plan');}});assert.equal(c.autopilot.enabled,false);assert.equal(sent,1);
});
test('dispatch guard rechecks revocation after a command has been queued',async()=>{
 const c=fixture({talk:true});let sent=false;
 await runAutopilot({profile,character:c,game:{refresh:async()=>{}},save:async()=>{},now:()=>2000,
 plan:async()=>({suggestions:[{op:'say',title:'Greet',argumentsJson:'{"text":"hello"}'}]}),
 execute:async(p,op,args,id,guard)=>{pauseAutopilotState(c,'manual');assert.throws(()=>guard.authorize(c.state));return {status:'refused'};}});
 assert.equal(sent,false);assert.equal(c.autopilot.enabled,false);
});
test('live transport is never reached when final dispatch authorization is revoked',async()=>{
 const c=fixture({talk:true});const game=new Game({character:()=>c},false);let sent=0;
 game.assertCharacter=async()=>{pauseAutopilotState(c,'manual');return c.state;};
 game.transport=async()=>{sent++;return {ok:true};};
 const revision=c.autopilot.revision;
 const result=await game.execute(profile,'say',{text:'hello'},{world:'w',entity:'me',credential:'one',location:'yard',expires:Date.now()+60000,authorize:current=>authorizeAutopilot({character:c,profile,revision,op:'say',args:{text:'hello'},current,now:2000})});
 assert.equal(result.ok,false);assert.equal(sent,0);
});
test('refused delivery pauses instead of retrying and expiration prevents model work',async()=>{
 const c=fixture({talk:true});let calls=0;
 const deps={profile,character:c,game:{refresh:async()=>{}},save:async()=>{},now:()=>2000,plan:async()=>{calls++;return {suggestions:[{op:'say',argumentsJson:'{"text":"hello"}'}]};},execute:async()=>({status:'uncertain',message:'Connection lost'})};
 await runAutopilot(deps);assert.equal(c.autopilot.enabled,false);await runAutopilot(deps);assert.equal(calls,1);
 c.autopilot=startAutopilot(c,profile,autopilotConfig({prompt:'x',permissions:{talk:true}}),1000);c.autopilot.expires=1500;
 await runAutopilot(deps);assert.equal(calls,1);assert.equal(c.autopilot.enabled,false);
});
test('API starts only explicitly, pauses on manual messages and never resumes after restart',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gr-autopilot-')),app=await startServer({demo:true,port:0,dataDir:dir,liveIntervalMs:30});t.after(()=>app.stop());let csrf;
 const call=async(path,body)=>{const r=await fetch(app.url+'api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Glass-Reach-Dashboard':'1','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 csrf=(await call('session')).data.csrf;const config={prompt:'Listen and answer politely.',permissions:{talk:true}};
 await call('autopilot',{config});const c=app.store.character('aaron');assert.equal(c.autopilot.enabled,false);
 await call('autopilot',{config,start:true});assert.equal(c.autopilot.enabled,true);
 await new Promise(r=>setTimeout(r,90));assert.equal(c.autopilot.decisions,1);assert.equal(c.autopilot.actions,0);
 await call('agent',{text:'What do I see?',mode:'chat'});assert.equal(c.autopilot.enabled,false);
 for(let i=0;i<50&&c.agentStatus==='working';i++)await new Promise(r=>setTimeout(r,10));
 await call('autopilot',{config,start:true});assert.equal(c.autopilot.enabled,true);
 app.stop();await app.store.queue;const restored=await new Store(dir,true).init();assert.equal(restored.character('aaron').autopilot.enabled,false);
});
