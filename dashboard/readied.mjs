import {normalizeTrigger,evaluateTrigger,condition} from './triggers.mjs';
import { randomUUID } from 'node:crypto';
import { validateOperation } from './game.mjs';

export function prepareReadied(body) {
  const trigger=normalizeTrigger(body.trigger);
  if (!['act','say'].includes(body.op)) throw new Error('Choose one game action or line of dialogue.');
  validateOperation(body.op,body.args);
  if (body.op==='act' && body.args.target!==undefined && typeof body.args.target!=='string') throw new Error('Choose a game action target.');
  if (body.op==='act' && body.args.params!==undefined && (!body.args.params || typeof body.args.params!=='object' || Array.isArray(body.args.params))) {
    throw new Error('Game action inputs must be an object.');
  }
  if (body.op==='say' && body.args.to!==undefined && typeof body.args.to!=='string') throw new Error('Choose a recipient.');
  const minutes=Number(body.minutes);
  if (![5,15,30,60,120].includes(minutes)) throw new Error('Choose how long to keep the action ready.');
  if(trigger.kind==='delay'&&trigger.threshold>=minutes)throw Error('The delay must be shorter than the expiry.');
  return {
    trigger,
    op:body.op,args:body.args,minutes,
  };
}

export function matchesReadied(rule,character) {return evaluateTrigger(rule,character);}

export async function runReadied({profile,character,store,execute,demo,saving}) {
  for (const rule of character.readied || []) {
    if (rule.status!=='armed' || saving.has(rule)) continue;
    let result;
    if (Date.now()>=rule.expires) result={status:'expired',message:'The time limit elapsed.'};
    else if (rule.entity!==profile.entityId || rule.credential!==profile.credential
      || ((demo || character.state?.connection==='Live') && rule.world!==character.state?.world)) {
      result={status:'cancelled',message:'The game connection or character changed.'};
    } else if (character.agentStatus==='working' || character.historyCoverage?.pending || !character.state || (!demo && character.state.connection!=='Live')) continue;
    else if (matchesReadied(rule,character)) {
      rule.status='executing';
      try {
        result=await execute(profile,rule.op,rule.args,'readied-'+rule.revision,{
          world:rule.world,entity:rule.entity,credential:rule.credential,location:character.state.here.id,expires:rule.expires,
          authorize:current=>{if(rule.status!=='executing')throw Error('Rule cancelled.');const scope=rule.trigger.scope||'current';if(scope!=='any'&&current.here.id!==(scope==='place'?rule.trigger.place:rule.location))throw Error('Outside approved location scope.');if(['water','hp','present','absent','destination','time','weather','available','wounded','downed','gameTime','delay'].includes(normalizeTrigger(rule.trigger).kind)&&!condition(rule,{...character,state:current}))throw Error('Trigger condition is no longer true.');},
        });
      } catch(error) {
        result={status:'uncertain',message:error.message};
      }
    } else continue;
    rule.status=result.status;
    rule.outcome=result.result?.reason||result.message||'Game confirmed the command.';
    character.messages.push({
      id:randomUUID(),role:'notice',timelineSeq:character.state?.cursor||0,time:new Date().toISOString(),
      text:'Readied action · '+rule.status+': '+(rule.op==='say'?'“'+rule.args.text+'”':rule.args.verb)+'. '+rule.outcome,
    });
    await store.save();
  }
}
