import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildScenes,storyPage,searchHistory,summarizeHistory} from './story.mjs';
import {startServer} from './server.mjs';

const character=()=>({names:{gate:'Gate Yard',road:'Salt Road',sera:'Sera'},state:{you:{id:'me'}},events:Array.from({length:1000},(_,i)=>({seq:i+1,t:i*60,kind:'say',actor:'sera',payload:{text:i===2?'Hollis left a silver wedge.':'The road is quiet.'},observedLocation:'gate'}))});
test('full archive search and scene pagination preserve events beyond session limit',()=>{
 const c=character();
 assert.equal(searchHistory(c,'Where is the silver wedge?').some(row=>row.event.seq===3),true);
 const latest=storyPage(c);assert.equal(latest.more,true);
 const earlier=storyPage(c,{before:latest.before});
 assert.equal(earlier.scenes[0].start,1);
 assert.equal(storyPage(c,{query:'silver wedge'}).scenes[0].start,1);
 assert.equal(buildScenes(c).flatMap(s=>s.events).length,1000);
 c.events.push({seq:1001,t:60000,kind:'moved',target:'me',payload:{to:'road'}});
 assert.equal(buildScenes(c).at(-1).title,'Salt Road');
});
test('long recaps cover all input events, reject invented references and reuse cached passes',async()=>{
 const c=character(),seen=new Set();let calls=0,saves=0;
 const ask=async(q,evidence)=>{calls++;for(const m of evidence.matchAll(/\[#(\d+)\]/g))seen.add(Number(m[1]));return evidence.split('\n').map(line=>line.match(/\[#\d+\]/)?.[0]||'').join(' ')+' [#999999]';};
 const result=await summarizeHistory({character:c,events:c.events,ask,save:async()=>{saves++;}});
 assert.equal(seen.size,1000);assert.ok(calls>2);assert.equal(saves,calls);assert.ok(!result.includes('#999999'));
 const count=calls;assert.equal(await summarizeHistory({character:c,events:c.events,ask}),result);assert.equal(calls,count);
});
test('recaps and polling never mark history read; markers persist per character',async t=>{
 const app=await startServer({demo:true,port:0,dataDir:await mkdtemp(join(tmpdir(),'gr-story-test-'))});t.after(()=>app.stop());
 let csrf;
 const call=async(path,body)=>{const r=await fetch(app.url+'api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Glass-Reach-Dashboard':'1','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 csrf=(await call('session')).data.csrf;
 const page=(await call('story')).data;assert.equal(page.unread,9);
 assert.equal((await call('event?seq=1')).status,200);
 await call('story/recap',{range:'all'});
 for(let n=0;n<100&&app.store.character('aaron').recapJob.status==='working';n++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(app.store.character('aaron').recapJob.status,'complete');
 assert.equal((await call('story')).data.unread,9);
 await call('story/read',{through:5});await call('session');
 assert.equal((await call('story')).data.unread,4);
 assert.equal((await call('story/read',{through:999})).status,400);
 app.store.character('aaron').historyCoverage={pending:true};
 assert.equal((await call('story/read',{through:9})).status,400);
 assert.equal((await call('story/recap',{range:'all'})).status,400);
});
