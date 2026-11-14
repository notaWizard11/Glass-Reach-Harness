import { randomUUID } from 'node:crypto';
import { validateOperation } from './game.mjs';

export function prepareReadied(body) {
  const { kind, person, phrase } = body.trigger || {};
  if (!['arrival','reply','water','dusk'].includes(kind)) throw new Error('Choose a trigger.');
  if (['arrival','reply'].includes(kind) && (typeof person !== 'string' || !person || person.length > 200)) {
    throw new Error('Choose a character for this trigger.');
  }
  if (kind === 'reply' && (typeof phrase !== 'string' || phrase.length > 200)) throw new Error('Enter up to 200 characters for the phrase.');
  if (!['act','say'].includes(body.op)) throw new Error('Choose one game action or line of dialogue.');
  validateOperation(body.op,body.args);
  if (body.op==='act' && body.args.target!==undefined && typeof body.args.target!=='string') throw new Error('Choose a game action target.');
  if (body.op==='act' && body.args.params!==undefined && (!body.args.params || typeof body.args.params!=='object' || Array.isArray(body.args.params))) {
    throw new Error('Game action inputs must be an object.');
  }
  if (body.op==='say' && body.args.to!==undefined && typeof body.args.to!=='string') throw new Error('Choose a recipient.');
  const minutes=Number(body.minutes);
  if (![5,15,30,60,120].includes(minutes)) throw new Error('Choose how long to keep the action ready.');
  return {
    trigger:{kind,...(person?{person}:{}),...(kind==='reply'?{phrase:phrase.trim()}: {})},
    op:body.op,args:body.args,minutes,
  };
}

export function matchesReadied(rule,character) {
  const { state, events }=character;
  const { kind, person, phrase }=rule.trigger;
  if (state.here.id!==rule.location) return false;
  if (kind==='water') return typeof state.you.state?.water==='number' && state.you.state.water<=3;
  if (kind==='dusk') return state.ambient?.time_of_day==='dusk';
  return events.some(event=>{
    if (event.seq<=rule.since) return false;
    const payload=event.payload || {};
    if (kind==='arrival') {
      return event.kind==='moved' && event.target===person && payload.to===rule.location && payload.from!==rule.location
        || event.kind==='arrived' && (payload.who||event.actor)===person && (payload.place||event.target)===rule.location;
    }
    return event.kind==='say' && event.actor===person && (payload.to||event.target)===rule.entity
      && typeof payload.text==='string' && payload.text.toLowerCase().includes(phrase.toLowerCase());
  });
}

export async function runReadied({profile,character,store,execute,demo,saving}) {
  for (const rule of character.readied || []) {
    if (rule.status!=='armed' || saving.has(rule)) continue;
    let result;
    if (Date.now()>=rule.expires) result={status:'expired',message:'The time limit elapsed.'};
    else if (rule.entity!==profile.entityId || rule.credential!==profile.credential
      || ((demo || character.state?.connection==='Live') && rule.world!==character.state?.world)) {
      result={status:'cancelled',message:'The game connection or character changed.'};
    } else if (character.agentStatus==='working' || !character.state || (!demo && character.state.connection!=='Live')) continue;
    else if (matchesReadied(rule,character)) {
      rule.status='executing';
      try {
        result=await execute(profile,rule.op,rule.args,'readied-'+rule.revision,{
          world:rule.world,entity:rule.entity,credential:rule.credential,location:rule.location,expires:rule.expires,
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
