import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingest } from './store.mjs';
export const readOps=new Set(['inspect','recall','seats','timers','find','programs','clock','summary']);
export const writeOps=new Set(['act','say','remember','intend','join','away','reclaim']);
export function validateOperation(op,args={}) {
  if(!writeOps.has(op)) throw new Error('Unsupported game action.');
  if(!args||typeof args!=='object'||Array.isArray(args)) throw new Error('Action arguments must be an object.');
  const allowed={act:['verb','target','params'],say:['text','to','reach'],remember:['text'],intend:['text','why','id','status','priority'],join:['entity','template','name','description'],away:['give','answer','sleep'],reclaim:['thing']}[op];
  if(Object.keys(args).some(k=>!allowed.includes(k))) throw new Error('Unsupported action parameter.');
  if(op==='act'&&(!args.verb||typeof args.verb!=='string')) throw new Error('Choose an action.');
  if(op==='say'&&(typeof args.text!=='string'||!args.text.trim()||args.text.length>4000)) throw new Error('Enter a shorter line of dialogue.');
  if(op==='say'&&args.reach!=null&&![0,1,2].includes(args.reach)) throw new Error('Invalid speech reach.');
  return args;
}
export class Game {
  constructor(store,demo=false){this.store=store;this.demo=demo;this.locks=new Map();}
  serial(p,fn){ const key=p.credential; const task=(this.locks.get(key)||Promise.resolve()).then(fn); this.locks.set(key,task.catch(()=>{})); return task; }
  credential(p){return p.credential==='legacy'?fileURLToPath(new URL('../.glassreach-token.dpapi',import.meta.url)):join(this.store.dir,p.credential+'.dpapi');}
  async transport(p,op,args={},save=false){
    const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe');
    return new Promise((resolve,reject)=>{
      const child=spawn(existsSync(bundled)?bundled:'powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',fileURLToPath(new URL('game-transport.ps1',import.meta.url)),'-CredentialPath',this.credential(p),...(save?['-SaveCredential']:[])],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      let out='';const timer=setTimeout(()=>{child.kill();reject(new Error('Game request timed out; delivery is uncertain. Refresh before retrying.'));},45000);
      child.stdout.on('data',b=>{out+=b;if(out.length>8000000)child.kill();});child.stderr.resume();
      child.on('error',()=>{clearTimeout(timer);reject(new Error('Could not start the Windows game connection.'));});
      child.on('close',()=>{clearTimeout(timer);try{const r=JSON.parse(out);if(r.transportError)reject(new Error(r.reason));else resolve(r);}catch{reject(new Error('Invalid response from the game connection.'));}});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(save?args:{op,args}));
    });
  }
  async importLegacy(){
    const c=this.store.character('aaron');if(c.state||this.demo)return;
    try { const rows=(await readFile(new URL('../.glassreach-observations.jsonl',import.meta.url),'utf8')).trim().split(/\r?\n/);let events=[];
      for(const line of rows){let r;try{r=JSON.parse(line);}catch{continue;}for(const e of [r,r.event,...(Array.isArray(r)?r:r.events||[])])if(e?.seq&&e.kind)events.push(e);if(r.you?.id===this.store.profile('aaron').entityId&&r.here)ingest(c,r);}
      if(c.state){ingest(c,c.state,events);c.state.connection='Saved observation';await this.store.save();}
    }catch{}
  }
  async read(p,op,args={}){if(!readOps.has(op))throw new Error('Unsupported inspection.');if('principal'in args||'from_entity'in args||'entity'in args&&op!=='inspect')throw new Error('This inspection must use the selected character.');return this.serial(p,async()=>{if(this.demo)return this.demoRead(p,op,args);if(!['seats','summary'].includes(op))await this.assertCharacter(p);return this.transport(p,op,args);});}
  async assertCharacter(p){const r=await this.transport(p,'perceive',{events:0});if(r.you?.id!==p.entityId)throw new Error('This game connection is controlling a different character or has expired. Use Reconnect for the selected profile.');return r;}
  async refresh(p){return this.serial(p,()=>this.refreshUnlocked(p));}
  async refreshUnlocked(p){
    const c=this.store.character(p.id);
    if(this.demo){if(!c.state)ingest(c,await this.demoState(p));c.state.connection='Demo';return c.state;}
    try{
      let r=await this.transport(p,'perceive',{cursor:c.state?.cursor||0,events:100,layout:true});
      if(r.ok===false&&/layout|argument|parameter/i.test(r.reason||''))r=await this.transport(p,'perceive',{cursor:c.state?.cursor||0,events:100});
      if(r.you?.id!==p.entityId)throw new Error('Character session expired or another character is active. Reconnect the selected character.');
      let cursor=c.historyCursor||0;const events=[];
      // Bound each refresh. The next refresh continues without dropping a page.
      for(let page=0;page<8;page++){
        const batch=await this.transport(p,'history',{since:cursor,limit:500});if(!Array.isArray(batch))throw new Error(batch.reason||'History unavailable.');
        events.push(...batch);if(!batch.length)break;const next=Math.max(...batch.map(e=>e.seq));if(next<=cursor)break;cursor=next;if(batch.length<500)break;
      }
      ingest(c,r,events);await this.store.save();return c.state;
    }catch(e){if(c.state){c.state.connection='Saved observation';c.state.problem=e.message;await this.store.save();return c.state;}throw e;}
  }
  async execute(p,op,args,guard){validateOperation(op,args);return this.serial(p,async()=>{
    if(guard){
      if(p.entityId!==guard.entity || p.credential!==guard.credential){
        return {ok:false,reason:'The character connection changed before dispatch.'};
      }
      const current=this.demo?this.store.character(p.id).state:await this.assertCharacter(p);
      if(current?.you?.id!==guard.entity || current.world!==guard.world || current.here?.id!==guard.location){
        return {ok:false,reason:'The character, world or scene changed before dispatch.'};
      }
      if(Date.now()>=guard.expires)return {ok:false,reason:'The readied action expired before dispatch.'};
    }
    if(this.demo)return this.demoExecute(p,op,args);
    if(op!=='join'&&!guard)await this.assertCharacter(p);
    const result=await this.transport(p,op,args);
    if(result.ok===false)return result;
    if(op==='join'&&args.template){const r=await this.transport(p,'perceive',{events:0});if(!r.you?.id)throw new Error('Character creation response uncertain; inspect seats before retrying.');p.entityId=r.you.id;p.name=r.you.name;}
    if(op==='join'&&args.entity&&args.entity!==p.entityId)throw new Error('Profile character mismatch.');
    await this.refreshUnlocked(p);return result;
  });}
  async demoState(p){const s=JSON.parse(await readFile(new URL('fixture.json',import.meta.url),'utf8'));s.you.id=p.entityId;s.you.name=p.name;return s;}
  demoRead(p,op,args){const s=this.store.character(p.id).state;if(op==='inspect')return [...s.holding,...s.present,s.you,s.here].find(x=>x.id===args.entity)||{name:args.entity,state:{},contents:[]};if(op==='recall')return {exchanges:s.events||[],notes:s.you.state.memory,goals:s.goals,edges:s.relations||[]};if(op==='seats')return {seats:[{id:'demo-scout',name:'Sera Vale',held:false}],templates:[{template:'scout',doc:'A traveller with a keen eye'}]};if(op==='timers')return [{kind:'dusk',in:3600}];return {note:'Fictional demonstration',state:s.here.state};}
  async demoExecute(p,op,args){const c=this.store.character(p.id);const s=c.state;const seq=(c.events.at(-1)?.seq||0)+1;let event={seq,t:seq*30,actor:p.entityId,target:args.target||args.to||p.entityId,kind:op,payload:{}};
    if(op==='say'){event.kind='say';event.payload={text:args.text,to:args.to};}
    if(op==='remember')s.you.state.memory.push({seq,text:args.text});
    if(op==='intend'){let g=s.goals.find(x=>x.id===args.id);if(g)Object.assign(g,args);else s.goals.push({id:'g'+seq,status:'active',...args});}
    if(op==='join'&&args.template){p.entityId='demo-'+Date.now();p.name=args.name||p.name;s.you.id=p.entityId;s.you.name=p.name;}
    if(op==='act'){
      event.kind='act';event.payload=args;
      if(args.verb==='go'){const exit=s.exits.find(x=>x.to===args.target);if(!exit)return {ok:false,reason:'No known exit leads there.'};s.here={id:exit.to,name:exit.name,state:{description:'A fictional destination beyond the gate.'}};s.exits=[{to:'gate',name:'The Gate Yard'}];event.kind='arrived';event.payload={who:p.entityId,place:exit.to};}
      if(args.verb==='drink'){s.you.state.water=Math.min(10,s.you.state.water+4);event.kind='drank';event.payload={by:p.entityId,water:s.you.state.water};}
      if(args.verb==='give'){const i=s.holding.findIndex(x=>x.id===args.params?.item);if(i<0)return {ok:false,reason:'Choose an item you hold.'};event.kind='given';event.payload={item:s.holding[i].id,by:p.entityId};s.holding.splice(i,1);}
    }
    ingest(c,{...s,cursor:seq,events:[event]},[event]);c.state.connection='Demo';await this.store.save();return {ok:true,demo:true,event};
  }
}
