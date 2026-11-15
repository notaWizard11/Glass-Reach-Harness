import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveCodex } from './codex-path.mjs';
import {composeInstructions,baseInstructions,buildContext} from './prompts.mjs';
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const str={type:'string'};
const recordsSchema={type:'array',items:obj({kind:{type:'string',enum:['quest','memory','note']},id:str,title:str,text:str,status:{type:'string',enum:['discovered','active','blocked','completed','dismissed']},sourceSeqs:{type:'array',items:{type:'integer'}}})};
export const answerSchema=obj({reply:str,records:recordsSchema,suggestions:{type:'array',items:obj({title:str,reason:str,op:{type:'string',enum:['act','say','remember','intend','inspect','recall']},argumentsJson:str})},map:{anyOf:[{type:'null'},obj({title:str,description:str,nodes:{type:'array',items:obj({id:str,label:str,x:{type:'number'},y:{type:'number'},note:str})},edges:{type:'array',items:obj({from:str,to:str,uncertain:{type:'boolean'}})}})]}});
export const modelForPurpose=(data,purpose)=>{const key=purpose==='quests'?'suggestions':purpose==='scene-story'?'prose':['recap','scene-summary','rules-review'].includes(purpose)?'chat':purpose;return data.modelsByPurpose?.[key]||data.model||undefined;};
export class Agent {
  constructor(store){this.store=store;this.pending=new Map();this.next=1;this.turns=new Map();this.loaded=new Set();}
  async start(){if(this.ready)return this.ready;this.ready=this.connect().catch(e=>{this.close();this.ready=null;throw e;});return this.ready;}
  async connect(){
    const home=process.env.CODEX_HOME||join(homedir(),'.codex');let config='';try{config=await readFile(join(home,'config.toml'),'utf8');}catch{}
    const overrides=['features.shell_tool=false','features.unified_exec=false','features.apps=false','features.plugins=false','features.browser_use=false','features.computer_use=false','features.multi_agent=false','features.code_mode=false','features.skip_host_skill_discovery=true','web_search="disabled"'];
    // CLI dotted override keys are literal path segments, not quoted TOML keys.
    for(const m of config.matchAll(/^\[mcp_servers\.(?:"([^"]+)"|([\w-]+))\]/gm)){
      const name=m[1]||m[2];if(!/^[\w-]+$/.test(name))throw new Error('An MCP server name cannot be safely overridden for this companion. Use a separate Codex configuration.');
      overrides.push(`mcp_servers.${name}.enabled=false`);
    }
    const cwd=join(this.store.dir,'agent-workspace');await mkdir(cwd,{recursive:true});this.cwd=cwd;
    const executable=await resolveCodex();
    this.child=spawn(executable,['app-server',...overrides.flatMap(x=>['-c',x])],{cwd,windowsHide:true,env:{...process.env,CODEX_HOME:home},stdio:['pipe','pipe','pipe']});
    this.child.stderr.resume();this.child.stdin.on('error',()=>{});
    createInterface({input:this.child.stdout}).on('line',line=>{try{this.receive(JSON.parse(line));}catch{}});
    this.child.on('error',e=>this.fail('Codex could not be launched ('+(e.code||'startup error')+'). Check the installed executable or GLASS_REACH_CODEX setting.'));
    this.child.on('exit',()=>this.fail('Codex disconnected. Your saved conversation is still available.'));
    await this.request('initialize',{clientInfo:{name:'glass_reach_companion',title:'Glass Reach',version:'2.0.0'}},20000);
    this.send({method:'initialized',params:{}});
    let cursor=null;do{const catalog=await this.request('mcpServerStatus/list',{limit:100,...(cursor?{cursor}:{})});if((catalog.data||[]).some(s=>Object.keys(s.tools||{}).length))throw new Error('Codex exposed external tools. The companion will not start until its tool isolation is restored.');cursor=catalog.nextCursor;}while(cursor);
    const account=await this.request('account/read',{refreshToken:false});
    this.models=[];cursor=null;do{const models=await this.request('model/list',{limit:100,...(cursor?{cursor}:{})});this.models.push(...(models.data||[]));cursor=models.nextCursor;}while(cursor);
    this.account=account.account?{type:account.account.type}:null;
    return {connected:true,account:this.account,models:this.models};
  }
  send(m){this.child?.stdin.write(JSON.stringify(m)+'\n');}
  request(method,params,timeout=30000){return new Promise((resolve,reject)=>{const id=this.next++;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex did not answer '+method+'.'));},timeout);this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
  receive(m){
    if(m.id!=null&&m.method){this.send({id:m.id,error:{code:-32601,message:'This companion accepts no tool execution or permission escalation. Return a proposed game action in the response instead.'}});return;}
    if(m.id!=null){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}return;}
    const p=m.params||{},task=this.turns.get(p.threadId);if(!task)return;
    if(m.method==='turn/started')task.turnId=p.turn.id;
    if(m.method==='item/agentMessage/delta'){task.text+=p.delta||'';task.progress?.(task.text);}
    if(m.method==='item/completed'&&p.item?.type==='agentMessage'){task.text=p.item.text||task.text;}
    if(m.method==='turn/completed'){
      this.turns.delete(p.threadId);clearTimeout(task.timer);
      if(p.turn.status!=='completed')task.reject(new Error(p.turn.error?.message||'Response '+p.turn.status));
      else{try{task.resolve(JSON.parse(task.text));}catch{task.reject(new Error('Codex returned an incomplete response. No suggestions were executed.'));}}
    }
  }
  fail(message){this.ready=null;this.loaded.clear();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(message));}this.pending.clear();for(const t of this.turns.values()){clearTimeout(t.timer);t.reject(new Error(message));}this.turns.clear();}
  async reply(profile,text,purpose='chat',progress,execution,evidence,schema=answerSchema){
    await this.start();const c=this.store.character(profile.id);
    // Ephemeral model sessions receive the saved transcript on each request. The durable history is owned by this app.
    const thread=await this.request('thread/start',{cwd:this.cwd,ephemeral:true,sandbox:'read-only',approvalPolicy:'never',...(modelForPurpose(this.store.data,purpose)?{model:modelForPurpose(this.store.data,purpose)}:{}),baseInstructions,developerInstructions:composeInstructions(this.store.data,profile,c,purpose)});
    const tid=thread.thread.id;
    const context=buildContext(this.store.data,profile,c,purpose,text,execution,evidence);
    return new Promise((resolve,reject)=>{
      const task={resolve,reject,text:'',progress,turnId:null,timer:setTimeout(()=>{this.stopThread(tid);this.turns.delete(tid);reject(new Error('Codex response timed out. No further action was sent.'));},240000)};
      this.turns.set(tid,task);if(purpose==='autopilot')c.autopilotThread=tid;else if(purpose!=='scene-story')c.activeThread=tid;
      this.request('turn/start',{threadId:tid,input:[{type:'text',text:JSON.stringify(context)}],outputSchema:schema}).then(r=>{task.turnId=r.turn.id;}).catch(e=>{clearTimeout(task.timer);this.turns.delete(tid);reject(e);});
    });
  }
  async stopThread(tid){const t=this.turns.get(tid);if(t?.turnId)await this.request('turn/interrupt',{threadId:tid,turnId:t.turnId}).catch(()=>{});}
  close(){this.child?.stdin.end();this.child?.kill();}
}
