import { randomUUID } from 'node:crypto';
import { validateOperation } from './game.mjs';

// Each model decision is based on the result of the previous step, never a blind batch.
export async function runGameTurn({profile,character,text,game,plan,execute,save,cancelled,maxSteps=12}) {
  const runId=randomUUID(),results=[];
  for(let step=0;step<=maxSteps;step++){
    if(cancelled())return 'Stopped. Any already submitted action may still finish; check the event record.';
    await game.refresh(profile);
    if(!['Live','Demo'].includes(character.state?.connection))throw new Error(character.state?.problem||'Reconnect this character before acting in game.');
    if(cancelled())return 'Stopped before the next action.';
    const answer=await plan({request:text,results,remainingSteps:maxSteps-step});
    if(cancelled())return 'Stopped before the next action.';
    const actions=answer.suggestions||[];
    if(!actions.length)return answer.reply;
    if(step===maxSteps)return 'Paused after '+maxSteps+' steps. Review the recorded results before asking me to continue.';
    if(actions.length!==1)throw new Error('The agent returned more than one next step. No further action was sent.');
    const next=actions[0],args=JSON.parse(next.argumentsJson);
    let result;
    if(['inspect','recall'].includes(next.op)){
      const allowed=next.op==='inspect'?['entity']:['about'];
      if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!allowed.includes(k)))throw new Error('Invalid inspection arguments.');
      result={status:'complete',result:await game.read(profile,next.op,args)};
      if(result.result?.ok===false)result.status='refused';
    }else{
      if(!['act','say','remember','intend'].includes(next.op))throw new Error('This operation is not available in Act in game.');
      validateOperation(next.op,args);
      result=await execute(profile,next.op,args,runId+'-'+step);
    }
    const evidence={step:step+1,title:next.title,op:next.op,args,...result};results.push(evidence);
    // Save evidence before asking the model what comes next. Never retry on restart.
    character.messages.push({id:randomUUID(),role:'notice',mode:'game',text:next.title+' — '+result.status+(result.result?.reason?' · '+result.result.reason:result.message?' · '+result.message:''),time:new Date().toISOString(),execution:evidence});
    await save();
    if(result.status!=='complete')return 'Stopped: '+(result.result?.reason||result.message||result.status)+'. Check the event record before retrying.';
  }
}
