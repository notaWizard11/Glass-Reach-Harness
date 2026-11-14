import test from 'node:test';
import assert from 'node:assert/strict';
import {runGameTurn} from './game-turn.mjs';
function setup(){
 const character={state:{connection:'Live'},messages:[]},calls=[];let stopped=false;
 return {calls,character,stop:()=>{stopped=true;},options:{profile:{id:'test'},character,text:'Go to the yard, retrieve the wedge, then ask about the traveller.',save:async()=>{},cancelled:()=>stopped,game:{refresh:async()=>{calls.push('refresh');},read:async(p,op,args)=>{calls.push(op);return {contents:[{id:'wedge'}]};}},execute:async(p,op,args,id)=>{calls.push(args.verb||op);return {status:'complete',result:{ok:true}};}}};
}
const answer=(op,args)=>({reply:'',suggestions:[{title:op,op,argumentsJson:JSON.stringify(args)}]});
test('game requests execute sequentially with observation and inspection results',async()=>{
 const s=setup(),plans=[answer('act',{verb:'go',target:'yard'}),answer('inspect',{entity:'box'}),answer('act',{verb:'take',target:'wedge'}),answer('say',{text:'What happened to the traveller?'}),{reply:'Retrieved the wedge and asked those present.',suggestions:[]}];
 const reply=await runGameTurn({...s.options,plan:async context=>{if(context.results.length===2)assert.equal(context.results[1].result.contents[0].id,'wedge');return plans.shift();}});
 assert.match(reply,/Retrieved/);assert.deepEqual(s.calls,['refresh','go','refresh','inspect','refresh','take','refresh','say','refresh']);assert.equal(s.character.messages.length,4);
});
for(const status of ['refused','uncertain'])test('stops after '+status+' delivery',async()=>{
 const s=setup();let planned=0;const reply=await runGameTurn({...s.options,plan:async()=>{planned++;return answer('act',{verb:'go',target:'yard'});},execute:async()=>({status,message:'Blocked'})});assert.equal(planned,1);assert.match(reply,/Stopped: Blocked/);
});
test('Stop during planning prevents dispatch',async()=>{const s=setup();await runGameTurn({...s.options,plan:async()=>{s.stop();return answer('say',{text:'Hello'});}});assert.deepEqual(s.calls,['refresh']);});
test('offline observations and unsupported operations cannot execute',async()=>{const s=setup();s.character.state.connection='Saved observation';await assert.rejects(runGameTurn({...s.options,plan:async()=>answer('say',{text:'Hello'})}),/Reconnect/);s.character.state.connection='Live';await assert.rejects(runGameTurn({...s.options,plan:async()=>answer('join',{entity:'other'})}),/not available/);assert.ok(!s.calls.includes('join'));});
test('step limit ends repeated plans without another action',async()=>{const s=setup();const r=await runGameTurn({...s.options,maxSteps:2,plan:async()=>answer('say',{text:'Hello'})});assert.match(r,/Paused after 2/);assert.equal(s.calls.filter(x=>x==='say').length,2);});
