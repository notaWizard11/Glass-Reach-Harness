import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
export const defaultPrompt = `You are my companion in The Glass Reach. Describe the world clearly and preserve spoken dialogue verbatim. Distinguish witnessed facts, other characters' claims, and your interpretations. Use only the selected character's knowledge. Explain relevant choices without inventing outcomes. Prepare concrete game actions for my approval; never claim a proposed action has happened. Keep replies focused and atmospheric. When unsure, say what is unknown.`;
export class Store {
  constructor(dir, demo=false) { this.dir=dir; this.demo=demo; this.queue=Promise.resolve(); }
  async init() {
    await mkdir(this.dir,{recursive:true});
    try { this.data=JSON.parse(await readFile(join(this.dir,'ledger.json'),'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; this.data={version:2,masterPrompt:defaultPrompt,promptVersions:[],model:'',profiles:[{id:'aaron',name:this.demo?'Demo Keeper':'Player',entityId:this.demo?'demo-keeper':'',credential:'legacy',instructions:'',mode:'manual'}],characters:{}}; await this.save(); }
    // A request interrupted by a restart is never retried automatically.
    for(const c of Object.values(this.data.characters)) { if(c.agentStatus==='working') c.agentStatus='Interrupted by server restart';c.agentPreview='';for(const q of c.suggestions||[]) {if(q.status==='executing')q.status='uncertain';if(q.status==='reviewing')q.status='pending';}for(const r of Object.values(c.requests||{}))if(r.status==='pending')r.status='uncertain'; }
    for (const c of Object.values(this.data.characters)) {
      for (const rule of c.readied||[]) {
        if (rule.status!=='executing') continue;
        const request=c.requests?.['readied-'+rule.revision];
        rule.status=['complete','refused'].includes(request?.status)?request.status:'uncertain';
        rule.outcome=request?.result?.reason||(rule.status==='complete'?'Game confirmed the command.':'The server restarted during delivery. Check the game record.');
      }
    }
    await this.save(); return this;
  }
  profile(id) { const p=this.data.profiles.find(x=>x.id===id); if(!p) throw new Error('Character profile not found.'); return p; }
  character(id) { this.profile(id); return this.data.characters[id]??={state:null,events:[],messages:[],suggestions:[],maps:[],notes:[],organization:{},draft:'',agentStatus:'idle',threadId:null,requests:{}}; }
  save() { const content=JSON.stringify(this.data); const task=this.queue.then(async()=>{ const temp=join(this.dir,randomUUID()+'.tmp'); await writeFile(temp,content,'utf8'); for(let attempt=0;;attempt++){try{await rename(temp,join(this.dir,'ledger.json'));break;}catch(e){if(attempt>=5||!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;await delay(100*(attempt+1));}} }); this.queue=task.catch(()=>{}); return task; }
  publicData(id) { const c=this.character(id); return {profile:this.profile(id),profiles:this.data.profiles,masterPrompt:this.data.masterPrompt,promptVersions:this.data.promptVersions,model:this.data.model,modelsByPurpose:this.data.modelsByPurpose||{},...c,events:c.events.slice(-600),requests:undefined,demo:this.demo}; }
}
export function unique(rows,key='id') { return [...new Map(rows.filter(Boolean).map(x=>[x[key],x])).values()]; }
export function ingest(c, raw, events=[]) {
  if(!raw?.you?.id || !raw.here) throw new Error(raw?.reason||'Character is not connected. Use Reconnect.');
  const previous=c.state;
  const all=unique([...c.events,...events,...(raw.events||[])],'seq').sort((a,b)=>a.seq-b.seq);
  c.events=all;
  const placeMap=new Map((previous?.places||[]).map(p=>[p.id,p]));
  for(const p of [...(raw.known_places||[]),{...raw.here,observedAt:new Date().toISOString()}])placeMap.set(p.id,{...placeMap.get(p.id),...p});
  const places=[...placeMap.values()];
  const edges=(previous?.edges||[]).filter(e=>e.from!==raw.here.id);
  for(const e of raw.exits||[]) edges.push({...e,from:raw.here.id,observedAt:new Date().toISOString()});
  c.state={...raw,places,edges,updated:new Date().toISOString(),connection:'Live'};
  c.historyCursor=Math.max(c.historyCursor||0,...events.map(e=>Number(e.seq)||0));
  return c.state;
}
