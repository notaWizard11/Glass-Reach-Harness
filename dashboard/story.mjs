import { createHash } from 'node:crypto';

export function historicalNames(character) {
  const names={...character.names};
  const state=character.state||{};
  for(const entity of [state.you,state.here,...(state.places||[]),...(state.present||[]),...(state.holding||[])]){
    if(entity?.id&&entity.name)names[entity.id]=entity.name;
  }
  for(const person of state.knows||[])if(person.who&&person.name)names[person.who]=person.name;
  return names;
}

export function describeEvent(event,names={}) {
  const p=event.payload||{},name=id=>names[id]||id||'Someone';
  const who=name(p.by||p.who||p.entity||event.actor);
  switch(event.kind){
    case 'say': return who+' said'+(p.to?' to '+name(p.to):'')+': “'+(p.text||'')+'”';
    case 'scene': return p.text||'The scene was observed.';
    case 'left': return who+' left'+(p.to?' for '+name(p.to):'')+'.';
    case 'moved': return name(event.target||event.actor)+' moved to '+name(p.to)+'.';
    case 'arrived': return who+' arrived'+(p.place?' at '+name(p.place):'')+'.';
    case 'hit': return who+' hit '+name(event.target)+(p.dmg!=null?' for '+p.dmg+' damage':'')+(p.hp!=null?' ('+p.hp+' HP remaining)':'')+'.';
    case 'drank': return who+' drank'+(p.water!=null?' (water '+p.water+')':'')+'.';
    case 'embodied': return who+' connected as this character.';
    case 'released': return who+' was released from player control.';
    case 'found': return who+' found '+name(p.thing||event.target)+'.';
    case 'given': return who+' gave '+name(p.thing||p.item)+(p.to?' to '+name(p.to):'')+'.';
    case 'progressed': return who+' progressed in '+(p.skill||'a skill')+(p.how?': '+p.how:'.');
    case 'act': return who+' performed '+(p.verb||'an action')+(event.target?' involving '+name(event.target):'')+'.';
    case 'checked': return who+' made a '+(p.skill||'skill')+' check'+(p.success!=null?(p.success?' and passed':' and missed'):'')+'.';
    default: return who+' · '+event.kind.replaceAll('_',' ')+(p.text?' · '+p.text:p.why?' · '+p.why:'');
  }
}

export function buildScenes(character) {
  const names=historicalNames(character),scenes=[];
  let scene,location=null;
  for(const event of character.events){
    const p=event.payload||{};
    const self=character.state?.you?.id;
    let nextLocation=event.observedLocation||location;
    if(event.kind==='moved'&&event.target===self)nextLocation=p.to||nextLocation;
    if(event.kind==='arrived'&&(p.who||event.actor)===self)nextLocation=p.place||nextLocation;
    const quiet=scene&&Number.isFinite(event.t)&&Number.isFinite(scene.endTime)&&event.t-scene.endTime>1800;
    const fight=['hit','attacked','downed','died'].includes(event.kind);
    if(!scene||scene.events.length>=60||quiet||(nextLocation&&nextLocation!==location)||(fight&&!scene.fight&&scene.events.length>5)){
      scene={id:String(event.seq),title:names[nextLocation]||'Earlier observations',location:nextLocation,
        start:event.seq,end:event.seq,startTime:event.t,endTime:event.t,events:[],fight};
      scenes.push(scene);
    }
    location=nextLocation;
    scene.events.push(event);
    scene.end=event.seq;scene.endTime=event.t;scene.fight||=fight;
  }
  return scenes;
}

export function sceneEvidence(character,scene){
  const messages=(character.messages||[]).filter(message=>message.mode==='game'&&message.timelineSeq>=scene.start&&message.timelineSeq<=scene.end);
  const events=scene.events.map(event=>({...event,playerRecord:messages.filter(message=>message.timelineSeq===event.seq).map(({role,text})=>({role,text}))}));
  // A message can be anchored to a cursor without an event visible to this character.
  const unattached=messages.filter(message=>!events.some(event=>event.seq===message.timelineSeq));
  if(events.length&&unattached.length)events.at(-1).playerRecord.push(...unattached.map(({role,text})=>({role,text})));
  return {events,key:createHash('sha256').update('book-v1'+JSON.stringify(events)).digest('hex')};
}

export function storyPage(character,{before=Infinity,query='',limit=12}={}) {
  const names=historicalNames(character),words=query.toLowerCase().trim();
  const all=buildScenes(character).filter(scene=>scene.start<before);
  const matches=words?all.filter(scene=>[scene.title,...scene.events.map(e=>describeEvent(e,names))].join(' ').toLowerCase().includes(words)):all;
  const scenes=matches.slice(-limit);
  return {scenes:scenes.map(scene=>({
    ...scene,
    participants:[...new Set(scene.events.map(e=>e.payload?.by||e.payload?.who||e.actor).filter(Boolean))].map(id=>names[id]||id),
    summary:character.sceneNarratives?.[scene.id]?.end===scene.end?character.sceneNarratives[scene.id].text:null,
    prose:character.sceneProse?.[scene.id]?.text||null,
    proseFresh:character.sceneProse?.[scene.id]?.key===sceneEvidence(character,scene).key,
    lines:scene.events.map(event=>({seq:event.seq,text:describeEvent(event,names)})),
  })),more:matches.length>scenes.length,before:scenes[0]?.start,total:character.events.length};
}

export function searchHistory(character,query,limit=60){
  const names=historicalNames(character);
  const terms=(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])
    .filter(word=>!['what','when','where','that','this','with','have','from','about','could','would','please','there','happened'].includes(word));
  const scores=character.events.map((event,index)=>{
    const text=describeEvent(event,names).toLowerCase();
    return {index,score:terms.reduce((n,word)=>n+Number(text.includes(word)),0)};
  }).filter(row=>row.score).sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,limit/3);
  const indexes=new Set();
  for(const row of scores)for(let i=Math.max(0,row.index-1);i<=Math.min(character.events.length-1,row.index+1);i++)indexes.add(i);
  return [...indexes].sort((a,b)=>a-b).map(index=>({event:character.events[index],description:describeEvent(character.events[index],names)}));
}

export function coverageText(character){
  const coverage=character.historyCoverage;
  if(!character.events.length)return 'No recorded events yet.';
  if(coverage?.error)return 'Game connection interrupted. Recaps cover locally saved records. '+coverage.error;
  if(coverage?.pending)return 'Fetching older events. Wait for history to catch up before requesting a complete recap.';
  return (coverage?.checkedAt?'Game history checked '+new Date(coverage.checkedAt).toLocaleString()+'. ':'')+
    character.events.length+' saved events. Coverage begins with the earliest event returned by the game; unobserved events may be unavailable.';
}

// Bounded, cached passes cover every selected event without silently trimming a long absence.
export async function summarizeHistory({character,events,ask,progress=()=>{},cancelled=()=>false,save=async()=>{},question='Recap what happened chronologically, changes for the character, arrivals and departures, and unresolved matters.'}){
  const names=historicalNames(character);
  let chunks=[],chunk=[],size=0;
  for(const event of events){
    const line='[#'+event.seq+'] '+describeEvent(event,names)+' '+JSON.stringify(event);
    if(chunk.length&&size+line.length>18000){chunks.push(chunk.join('\n'));chunk=[];size=0;}
    chunk.push(line);size+=line.length;
  }
  if(chunk.length)chunks.push(chunk.join('\n'));
  if(!chunks.length)return 'No recorded game events in this interval.';
  character.storyCache??={};
  let pass=0;
  do{
    const results=[];
    for(let index=0;index<chunks.length;index++){
      if(cancelled())throw new Error('Recap stopped. Saved records remain available.');
      progress('Reading history · pass '+(pass+1)+' · '+(index+1)+' of '+chunks.length);
      const evidence=chunks[index];
      const key=createHash('sha256').update('story-v1\n'+question+'\n'+evidence).digest('hex');
      let summary=character.storyCache[key];
      if(!summary){
        summary=await ask(question,evidence);
        if(typeof summary!=='string'||!summary.trim())throw new Error('The agent returned an empty recap.');
        // Retain only references that belong to the supplied evidence.
        const allowed=new Set([...evidence.matchAll(/\[#(\d+)\]/g)].map(m=>m[1]));
        summary=summary.replace(/\[#(\d+)\]/g,(match,id)=>allowed.has(id)?match:'');
        character.storyCache[key]=summary;
        await save();
      }
      results.push(summary);
    }
    if(results.length===1)return results[0];
    chunks=[];
    // Pairwise reduction guarantees convergence while preserving source-linked sections.
    for(let i=0;i<results.length;i+=2)chunks.push(results.slice(i,i+2).join('\n\n'));
    pass++;
  }while(true);
}
