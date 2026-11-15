import {randomUUID} from 'node:crypto';

export const questStatuses=['discovered','active','blocked','completed','dismissed'];
const normalized=value=>String(value||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function recordPermissions(request){
  const text=String(request||'');
  if(/\b(?:should I|would I|what if|don't|do not|don’t)\b/i.test(text))return [];
  const saving=/\b(?:add|save|record|keep|remember|put|log|create|update|mark|complete|finish)\b/i.test(text);
  if(!saving)return [];
  return [...(/\b(?:quests?|objectives?|tasks?)\b/i.test(text)?['quest']:[]),...(/\b(?:memor(?:y|ies)|remember)\b/i.test(text)?['memory']:[]),...(/\bnotes?\b/i.test(text)?['note']:[])];
}

export function applyRecords(character,records,{allowed=[],automatic=false}={}){
  const saved=[],valid=new Set(character.events.map(e=>e.seq));
  for(const record of (records||[]).slice(0,20)){
    if(!allowed.includes(record.kind))continue;
    const title=String(record.title||'').trim().slice(0,160),text=String(record.text||'').trim().slice(0,8000);
    if(!text||!title)continue;
    const sources=[...new Set((record.sourceSeqs||[]).filter(seq=>Number.isSafeInteger(seq)&&valid.has(seq)))];
    if(automatic&&!sources.length)continue;
    const key=record.kind==='quest'?'quests':record.kind==='memory'?'journalMemories':'notes';
    const entries=character[key]??=[];
    let entry=record.id?entries.find(entry=>entry.id===record.id):null;
    if(record.id&&!entry)continue;
    entry??=entries.find(entry=>normalized(entry.title||entry.text)===normalized(title));
    if(entry&&automatic){entry.sources=[...new Set([...(entry.sources||[]),...sources])];continue;}
    if(!entry){entry={id:randomUUID(),created:new Date().toISOString(),origin:automatic?'story':'player'};entries.push(entry);}
    Object.assign(entry,{title,text,sources:[...new Set([...(entry.sources||[]),...sources])],updated:new Date().toISOString()});
    if(record.kind==='quest')entry.status=automatic?'discovered':questStatuses.includes(record.status)?record.status:'active';
    saved.push({kind:record.kind,id:entry.id,title:entry.title});
  }
  return saved;
}

export function captureDocuments(character,entities=[]){
  character.documents??=[];
  for(const entity of entities){
    const text=entity?.state?.text;
    if(!entity?.id||typeof text!=='string'||!text.trim())continue;
    let doc=character.documents.find(doc=>doc.entityId===entity.id);
    const observed=new Date().toISOString();
    if(!doc){doc={id:randomUUID(),entityId:entity.id,title:entity.name||entity.id,firstSeen:observed,versions:[]};character.documents.push(doc);}
    if(doc.text&&doc.text!==text)doc.versions.push({text:doc.text,observed:doc.lastSeen});
    Object.assign(doc,{title:entity.name||doc.title,text,lastSeen:observed,location:character.state?.here?.name||'',sourceCursor:character.state?.cursor});
  }
}
