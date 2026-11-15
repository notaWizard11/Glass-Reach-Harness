import test from 'node:test';import assert from 'node:assert/strict';
import {ResponseInbox,RESPONSE_LIFETIME,responseMessages} from './response-notifications.mjs';
import {startServer} from './server.mjs';import {mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const reply=(requestId,text='Reply',role='assistant')=>({id:requestId+'-reply',requestId,text,role});
test('only tracked off-Play composer responses notify, once, oldest first',()=>{
 let now=1000;const inbox=new ResponseInbox(()=>now);inbox.context('a','atlas');inbox.track('first','chat');
 assert.deepEqual(inbox.receive('a',[reply('old'),{id:'background',role:'assistant',text:'Auto prose'},reply('first','Question','user')]),[]);
 assert.equal(inbox.receive('a',[reply('first')]).length,1);assert.deepEqual(inbox.receive('a',[reply('first')]),[]);
 now+=1000;inbox.track('second','game');inbox.receive('a',[reply('second')]);assert.deepEqual(inbox.cards.map(c=>c.mode),['chat','game']);
 assert.equal(inbox.cards[0].expires,1000+RESPONSE_LIFETIME);
 inbox.dismiss('first-reply');assert.deepEqual(inbox.cards.map(c=>c.id),['second-reply']);
 now=2000+RESPONSE_LIFETIME;assert.deepEqual(inbox.expired(),['second-reply']);assert.deepEqual(inbox.cards,[]);
});
test('Play and disabled controls suppress replies without replaying them',()=>{
 const inbox=new ResponseInbox();inbox.context('a','play');inbox.track('play','chat');inbox.context('a','atlas');assert.deepEqual(inbox.receive('a',[reply('play')]),[]);
 inbox.track('offplay','chat');inbox.context('a','play');assert.deepEqual(inbox.receive('a',[reply('offplay')]),[]);inbox.context('a','atlas');assert.deepEqual(inbox.receive('a',[reply('offplay')]),[]);
 inbox.track('disabled','chat');inbox.context('a','atlas',false);inbox.receive('a',[reply('disabled')]);inbox.context('a','atlas',true);assert.deepEqual(inbox.receive('a',[reply('disabled')]),[]);
 inbox.track('clear','chat');inbox.receive('a',[reply('clear')]);inbox.context('a','play');assert.equal(inbox.cards.length,0);
});
test('profile changes clear cards and pending notifications; cancelled requests never notify',()=>{
 const inbox=new ResponseInbox();inbox.context('a','atlas');inbox.track('a','chat');inbox.context('b','settings');assert.deepEqual(inbox.receive('a',[reply('a')]),[]);inbox.context('a','atlas');assert.deepEqual(inbox.receive('a',[reply('a')]),[]);
 inbox.track('cancel','chat');inbox.cancel('cancel');assert.deepEqual(inbox.receive('a',[reply('cancel')]),[]);
 inbox.track('error','game');assert.equal(inbox.receive('a',[reply('error','Interrupted','error')])[0].error,true);
});
test('typed catch-up completions and errors participate without notifying for background recaps',()=>{
 const inbox=new ResponseInbox();inbox.context('a','journal');inbox.track('recap','chat');
 assert.equal(inbox.receive('a',responseMessages({recapJob:{id:'r',requestId:'recap',status:'working'}})).length,0);
 assert.equal(inbox.receive('a',responseMessages({recapJob:{id:'r',requestId:'recap',status:'complete',text:'Summary'}}))[0].text,'Summary');
 assert.equal(responseMessages({recapJob:{id:'r2',status:'complete',text:'Background'}}).length,0);
});
test('agent API correlates chat, game, and typed recap responses to their requests',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gr-response-')),app=await startServer({demo:true,port:0,dataDir:dir});t.after(()=>app.stop());
 const headers={'X-Glass-Reach-Dashboard':'1'},session=await (await fetch(app.url+'api/session',{headers})).json();
 for(const [requestId,mode,text]of [['chat-id','chat','Describe my options'],['game-id','game','Look around'],['recap-id','chat','Catch me up']]){
 const res=await fetch(app.url+'api/agent',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({requestId,mode,text})});assert.equal(res.status,202);
 const c=app.store.character('aaron');for(let i=0;i<100&&c.agentStatus==='working';i++)await new Promise(r=>setTimeout(r,10));
 assert.ok(responseMessages(c).some(m=>m.requestId===requestId&&m.role==='assistant'),requestId);
 }
 assert.equal((await fetch(app.url+'response-notifications.mjs')).status,200);
});
