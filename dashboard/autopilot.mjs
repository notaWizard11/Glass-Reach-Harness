import {randomUUID} from 'node:crypto';
import {validateOperation} from './game.mjs';

const travel=new Set(['go','creep','crawl','stay']);
const attack=new Set(['attack','shoot']);
const speech=new Set(['talk','parley','leave_word']);
const interaction=new Set(['check','search','read','drink','fill','toggle','tend','sleep','wake','take','put','drop','give','show','consult','compare','dig','harvest','dress','open','unlock','pick','lock']);
export function autopilotConfig(input={}){
 const prompt=String(input.prompt||'').trim();if(!prompt||prompt.length>8000)throw new Error('Enter motivations and goals, up to 8,000 characters.');
 const permissions=Object.fromEntries(['talk','travel','interact','attack','selfDefence'].map(key=>[key,input.permissions?.[key]===true]));
 if(!Object.values(permissions).some(Boolean))throw new Error('Choose at least one action permission.');
 const interval=Number(input.interval??60),minutes=Number(input.minutes??60),maxActions=Number(input.maxActions??20),maxDecisions=Number(input.maxDecisions??60);
 if(![30,60,120,300].includes(interval)||!Number.isInteger(minutes)||minutes<5||minutes>480||!Number.isInteger(maxActions)||maxActions<1||maxActions>200||!Number.isInteger(maxDecisions)||maxDecisions<1||maxDecisions>500)throw new Error('Choose valid duration, frequency and action/decision limits.');
 const locations=Array.isArray(input.locations)?[...new Set(input.locations.filter(x=>typeof x==='string'&&x.length<200))].slice(0,50):[];
 return {prompt,permissions,interval,minutes,maxActions,maxDecisions,locations};
}
export function startAutopilot(character,profile,config,now=Date.now()){
 if(!['Live','Demo'].includes(character.state?.connection)||character.state?.you?.id!==profile.entityId)throw new Error('Connect this character before starting autopilot.');
 if(character.state.you.state?.dead||character.state.you.state?.down)throw new Error('Autopilot cannot start while dead or down.');
 if(config.locations.length&&!config.locations.includes(character.state.here.id))throw new Error('Include the current location in the allowed locations.');
 return {config,enabled:true,status:'waiting',revision:randomUUID(),entity:profile.entityId,credential:profile.credential,world:character.state.world,
   started:now,expires:now+config.minutes*60000,startSeq:character.events.at(-1)?.seq||0,lastSeenSeq:character.events.at(-1)?.seq||0,actions:0,decisions:0,nextAt:now,log:character.autopilot?.log||[],reason:'Waiting for the first decision.'};
}
export function pauseAutopilotState(character,reason){
 const auto=character.autopilot;if(!auto)return;auto.enabled=false;auto.status='paused';auto.reason=reason;auto.revision=randomUUID();
}
export function autoLog(character,status,text,extra={}){
 const auto=character.autopilot;if(!auto)return;
 (auto.log??=[]).push({id:randomUUID(),time:new Date().toISOString(),status,text,...extra});auto.log=auto.log.slice(-200);
}
export function authorizeAutopilot({character,profile,revision,op,args,current,now=Date.now()}){
 const auto=character.autopilot;
 if(!auto?.enabled||auto.revision!==revision)throw new Error('Autopilot was paused or changed.');
 if(now>=auto.expires)throw new Error('Autopilot duration ended.');
 if(auto.actions>=auto.config.maxActions)throw new Error('Autopilot action limit reached.');
 if(profile.entityId!==auto.entity||profile.credential!==auto.credential||current?.you?.id!==auto.entity||current.world!==auto.world)throw new Error('Character connection changed.');
 if(current.you.state?.dead||current.you.state?.down)throw new Error('Character is down or dead.');
 const config=auto.config,permission=config.permissions;
 if(config.locations.length&&!config.locations.includes(current.here.id))throw new Error('Character left the allowed locations.');
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid command arguments.');
 const visible=[current.you,current.here,...(current.present||[]),...(current.holding||[])];
 if(op==='inspect'||op==='recall'){
   const key=op==='inspect'?'entity':'about';
   if(Object.keys(args).some(k=>k!==key)||typeof args[key]!=='string'||!visible.some(x=>x.id===args[key]))throw new Error('Inspection must refer to a currently visible entity.');
   return;
 }
 if(op==='say'){
   validateOperation(op,args);if(!permission.talk)throw new Error('Talking is not permitted.');
   if(args.reach!=null&&args.reach!==1)throw new Error('Autopilot speech is limited to the current scene.');
   if(args.to&&!visible.some(x=>x.id===args.to))throw new Error('Recipient is not visible.');
   return;
 }
 if(op!=='act')throw new Error('This operation is not permitted in autopilot.');
 validateOperation(op,args);const verb=args.verb,target=args.target;
 if(!(current.affordances||[]).some(a=>a.verb===verb&&(a.target===target||(!target&&a.target===auto.entity))))throw new Error('This action is not currently exposed by the game.');
 if(travel.has(verb)){
   if(!permission.travel)throw new Error('Travelling is not permitted.');
   if(verb!=='stay'&&(!(current.exits||[]).some(exit=>exit.to===target)||config.locations.length&&!config.locations.includes(target)))throw new Error('Destination is outside the allowed routes.');
 }else if(attack.has(verb)){
   const victim=(current.present||[]).find(x=>x.id===target);
   if(!victim||target===auto.entity||victim.state?.dead||victim.state?.down||victim.state?.yielded||victim.state?.yielded_to||victim.state?.surrendered||(Number.isFinite(victim.state?.hp)&&victim.state.hp<=0))throw new Error('Target is absent, incapacitated or surrendered.');
   if(!permission.attack){
     if(!permission.selfDefence)throw new Error('Attacking is not permitted.');
     const recent=character.events.some(event=>event.seq>auto.startSeq&&['hit','attacked','attack','missed','warded'].includes(event.kind)&&event.target===auto.entity&&(event.payload?.by||event.actor)===target&&Number.isFinite(event.t)&&Number.isFinite(current.t)&&current.t>=event.t&&current.t-event.t<=480);
     if(!recent)throw new Error('Self-defence requires a recent recorded attack against this character by that target.');
   }
 }else if(['brace','yield'].includes(verb)){
   if(!permission.selfDefence||target&&target!==auto.entity)throw new Error('Defensive actions are limited to yourself and require self-defence permission.');
 }else if(speech.has(verb)){
   if(!permission.talk)throw new Error('Talking is not permitted.');
 }else if(interaction.has(verb)){
   if(!permission.interact)throw new Error('Interacting with things is not permitted.');
 }else throw new Error('This verb is outside the autopilot action allowlist.');
}

export async function runAutopilot({profile,character,game,plan,execute,save,now=Date.now}){
 const auto=character.autopilot;if(!auto?.enabled||auto.status==='thinking'||auto.status==='sending'||character.agentStatus==='working'||now()<auto.nextAt)return;
 const revision=auto.revision,cancelled=()=>!character.autopilot?.enabled||character.autopilot.revision!==revision;
 try{
   if(now()>=auto.expires||auto.actions>=auto.config.maxActions||auto.decisions>=auto.config.maxDecisions)throw new Error('Autopilot reached its duration, action or decision limit.');
   auto.status='thinking';auto.decisions++;auto.nextAt=now()+auto.config.interval*1000;await save();
   await game.refresh(profile);
   if(cancelled())return;
   if(!['Live','Demo'].includes(character.state?.connection)||character.historyCoverage?.pending)throw new Error('Live game observations are unavailable or still catching up.');
   if(character.state.you?.id!==auto.entity||character.state.world!==auto.world||character.state.you.state?.dead||character.state.you.state?.down)throw new Error('Character connection or condition no longer permits autopilot.');
   const location=character.state.here.id;
   const events=character.events.filter(event=>event.seq>(auto.lastSeenSeq||auto.startSeq)).slice(0,200);
   const answer=await plan({config:auto.config,actionsUsed:auto.actions,decisionsUsed:auto.decisions,expires:auto.expires,eventsSinceLastDecision:events,activity:auto.log.slice(-8)});
   if(cancelled())return;
   auto.lastSeenSeq=events.at(-1)?.seq||auto.lastSeenSeq;
   const proposals=answer.suggestions||[];
   if(!proposals.length){auto.reason=answer.reply||'Waiting; no action needed.';autoLog(character,'wait',auto.reason);return;}
   if(proposals.length!==1)throw new Error('Autopilot must choose exactly one next step.');
   const proposal=proposals[0],op=proposal.op,args=JSON.parse(proposal.argumentsJson);
   await game.refresh(profile);if(cancelled())return;
   if(!['Live','Demo'].includes(character.state?.connection)||character.state.here.id!==location)throw new Error('Observation or location changed during planning; review before resuming.');
   authorizeAutopilot({character,profile,revision,op,args,current:character.state,now:now()});
   auto.status='sending';auto.reason=proposal.title;await save();if(cancelled())return;
   let result;
   if(['inspect','recall'].includes(op)){result={status:'complete',result:await game.read(profile,op,args)};if(result.result?.ok===false)result.status='refused';}
   else{
     auto.actions++;await save();if(cancelled())return;
     result=await execute(profile,op,args,'autopilot-'+revision+'-'+auto.decisions,{world:auto.world,entity:auto.entity,credential:auto.credential,location,expires:auto.expires,
       authorize:current=>authorizeAutopilot({character:{...character,autopilot:{...character.autopilot,actions:auto.actions-1}},profile,revision,op,args,current,now:now()})});
   }
   autoLog(character,result.status,proposal.title||op,{op,args,result});
   character.messages.push({id:randomUUID(),role:'notice',mode:'game',timelineSeq:character.state?.cursor||0,time:new Date().toISOString(),text:'Autopilot · '+(proposal.title||op)+' — '+result.status,execution:{op,args,...result}});
   if(result.status!=='complete')throw new Error(result.result?.reason||result.message||'Action delivery was not confirmed.');
   auto.reason='Last action: '+(proposal.title||op);
 }catch(error){if(!cancelled()){autoLog(character,'paused',error.message);pauseAutopilotState(character,error.message);}}
 finally{if(!cancelled()){auto.status='waiting';auto.nextAt=now()+auto.config.interval*1000;}await save();}
}
