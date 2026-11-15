export const groups={Movement:[['arrival','Arrives'],['departure','Leaves'],['present','Is present'],['absent','Is absent'],['destination','I reach a place']],Conversation:[['reply','Speaks to me'],['speech','Speaks nearby']],Resources:[['water','Low water'],['hp','Low health'],['damage','Health drops']],Combat:[['attack','Attacked'],['hit','Hit'],['missed','Attack misses'],['wounded','Character wounded'],['downed','Character downed']],Inventory:[['received','Item received'],['lost','Item leaves inventory']],Environment:[['time','Time of day'],['weather','Weather contains']],Timing:[['delay','Real-time delay'],['gameTime','Game-time deadline']],Actions:[['available','Action available']]};
export function normalizeTrigger(t={}){
 const kind=t.kind==='dusk'?'time':t.kind;
 if(!Object.values(groups).flat().some(([k])=>k===kind))throw Error('Choose a trigger.');
 const scope=t.scope||'current',mode=t.mode||'true';
 if(!['current','any','place'].includes(scope)||!['true','transition'].includes(mode))throw Error('Invalid trigger scope or mode.');
 const out={kind,scope,mode};
 for(const key of ['person','phrase','place','item','verb','target','value']){if(t[key]!=null){if(typeof t[key]!=='string'||t[key].length>200)throw Error('Invalid trigger input.');out[key]=t[key].trim();}}
 if(t.kind==='dusk')out.value='dusk';
 if(['arrival','departure','present','absent','wounded','downed'].includes(kind)&&!out.person)throw Error('Choose a character.');
 if((scope==='place'||kind==='destination')&&!out.place)throw Error('Choose a location.');
 if(['time','weather','available'].includes(kind)&&!(kind==='available'?out.verb:out.value))throw Error('Enter a condition.');
 if(['water','hp','delay','gameTime'].includes(kind)){out.threshold=Number(t.threshold??(kind==='water'?3:1));if(!Number.isFinite(out.threshold)||out.threshold<0||out.threshold>1e10)throw Error('Enter a valid non-negative threshold.');}
 return out;
}
export function condition(rule,c,now=Date.now()){
 const t=normalizeTrigger(rule.trigger),s=c.state||{},me=s.you?.state||{},person=s.present?.find(p=>p.id===t.person),events=(c.events||[]).filter(e=>e.seq>(rule.checkedSeq??rule.since??0));
 const inScope=t.scope==='any'||s.here?.id===(t.scope==='place'?t.place:rule.location);
 const kind=t.kind;
 let yes=false;
 if(kind==='water'||kind==='hp')yes=Number.isFinite(me[kind])&&me[kind]<=t.threshold;
 else if(kind==='damage')yes=Number.isFinite(rule.lastHp)&&Number.isFinite(me.hp)&&me.hp<rule.lastHp;
 else if(kind==='present'||kind==='absent')yes=kind==='present'?!!person:!person;
 else if(kind==='destination')yes=s.here?.id===t.place;
 else if(kind==='time')yes=s.ambient?.time_of_day===t.value;
 else if(kind==='weather')yes=(s.ambient?.weather||'').toLowerCase().includes(t.value.toLowerCase());
 else if(kind==='delay')yes=now>=(rule.started||now)+t.threshold*60000;
 else if(kind==='gameTime')yes=Number.isFinite(s.t)&&s.t>=t.threshold;
 else if(kind==='available')yes=(s.affordances||[]).some(a=>a.verb===t.verb&&(!t.target||a.target===t.target)&&a.ok===true);
 else if(kind==='wounded'||kind==='downed')yes=!!(t.person===s.you?.id?me:person?.state)?.[kind==='downed'?'down':kind];
 else if(kind==='received'||kind==='lost') {const ids=(s.holding||[]).map(i=>i.id),before=rule.inventory||[];yes=Array.isArray(rule.inventory)&&(kind==='received'?ids.some(id=>(!t.item||t.item===id)&&!before.includes(id)):before.some(id=>(!t.item||t.item===id)&&!ids.includes(id)));}
 else yes=events.some(e=>{const p=e.payload||{},who=p.who||e.actor;
 if(kind==='arrival')return (e.kind==='arrived'&&who===t.person&&(p.place||e.target)===s.here?.id)||(e.kind==='moved'&&e.target===t.person&&p.to===s.here?.id&&p.from!==p.to);
 if(kind==='departure')return e.kind==='left'&&(p.entity||who)===t.person&&(p.place||e.target)===s.here?.id||e.kind==='moved'&&e.target===t.person&&p.from===s.here?.id&&p.to!==p.from;
 if(kind==='reply'||kind==='speech')return e.kind==='say'&&(!t.person||e.actor===t.person)&&(kind==='speech'||(p.to||e.target)===rule.entity)&&typeof p.text==='string'&&p.text.toLowerCase().includes((t.phrase||'').toLowerCase());
 return (kind==='attack'?['hit','missed','attacked','attack','warded'].includes(e.kind):e.kind===kind)&&e.target===rule.entity&&(!t.person||(p.by||e.actor)===t.person);
 });
 return inScope&&yes;
}
export function primeTrigger(rule,c){rule.started=Date.now();rule.lastHp=c.state?.you?.state?.hp;rule.inventory=(c.state?.holding||[]).map(i=>i.id);rule.lastMatch=condition(rule,c);rule.checkedSeq=rule.since;}
export function evaluateTrigger(rule,c,now=Date.now()){
 const yes=condition(rule,c,now),t=normalizeTrigger(rule.trigger),eventKinds=['arrival','departure','reply','speech','attack','hit','missed','damage','received','lost'];
 const fired=yes&&(t.mode!=='transition'||eventKinds.includes(t.kind)||rule.lastMatch===false);
 rule.lastMatch=yes;rule.lastHp=c.state?.you?.state?.hp;rule.inventory=(c.state?.holding||[]).map(i=>i.id);rule.checkedSeq=Math.max(rule.checkedSeq||rule.since||0,...(c.events||[]).map(e=>e.seq));return fired;
}
