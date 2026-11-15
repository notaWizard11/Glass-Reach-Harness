import { runGameTurn } from './game-turn.mjs';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { Game, validateOperation } from './game.mjs';
import { Agent } from './agent.mjs';
import { prepareReadied, runReadied } from './readied.mjs';
import { generateSceneImage } from './scene-images.mjs';
import { storyPage, buildScenes, summarizeHistory, coverageText, describeEvent, historicalNames, sceneEvidence } from './story.mjs';
export async function startServer({demo=false,port=demo?47382:47381,dataDir,liveIntervalMs=5000,imageGenerator=generateSceneImage}={}) {
 const store=await new Store(dataDir||fileURLToPath(new URL('../.glassreach-data/'+(demo?'demo':'live'),import.meta.url)),demo).init();
 const game=new Game(store,demo),agent=new Agent(store);await game.importLegacy();
 const csrf=randomBytes(24).toString('hex'),watchers=new Map(),liveProfiles=new Map();
 const savingReadied=new WeakSet();
 const storyJobs=new Set();
 let proseBusy=false;
 async function writeSceneProse(p,sceneId){
   const c=store.character(p.id);
   if(proseBusy||c.agentStatus==='working'||c.historyCoverage?.pending)return {deferred:true};
   const scene=buildScenes(c).find(scene=>scene.id===String(sceneId));
   if(!scene)throw new Error('Scene no longer available.');
   const {events,key}=sceneEvidence(c,scene);
   if(c.sceneProse?.[scene.id]?.key===key)return {cached:true};
   if(c.storyProseJob?.scene===scene.id&&Date.now()-Date.parse(c.storyProseJob.started)<60000)return {deferred:true};
   proseBusy=true;
   const job=c.storyProseJob={scene:scene.id,status:'working',started:new Date().toISOString()};
   (async()=>{try{
     const text=await summarizeHistory({character:c,events,save:()=>store.save(),
       question:'Write this scene as a short passage in an unfolding novel, in second person for the player character. Integrate the character’s actual dialogue, meaningful actions and confirmed results with surrounding events. Player requests are intentions, not proof of success; assistant results are secondary to game records. Compress routine movement, repeated checks and insignificant actions. Preserve consequential dialogue accurately. Use 120–220 words of flowing prose, without headings, lists or operation names. Cite factual paragraphs with event IDs. Do not invent atmosphere, causation, motives or outcomes.',
       ask:async(question,evidence)=>demo?events.filter(event=>['say','scene'].includes(event.kind)).map(event=>describeEvent(event,historicalNames(c))+' [#'+event.seq+']').join(' '):(await agent.reply(p,question,'scene-story',undefined,undefined,evidence)).reply});
     (c.sceneProse??={})[scene.id]={text,key,end:scene.end};job.status='complete';
   }catch(error){job.status='error';job.error=error.message;}
   finally{proseBusy=false;await store.save();}})().catch(()=>{job.status='error';job.error='Could not save scene prose.';});
   return {started:true};
 }
 const sceneRequests=new Set(),sceneDir=join(store.dir,'scenes');
 let nextLiveAt=Date.now()+liveIntervalMs,liveChecking=null;
 const mobile=process.env.GLASS_REACH_MOBILE_ORIGIN?new URL(process.env.GLASS_REACH_MOBILE_ORIGIN):null,login=process.env.GLASS_REACH_MOBILE_LOGIN;
 if(mobile&&(mobile.protocol!=='https:'||!mobile.hostname.endsWith('.ts.net')||mobile.pathname!=='/'||!login))throw new Error('Private phone access requires an exact Tailscale HTTPS origin and login.');
 const assets={'/':['index.html','text/html'],'/style.css':['style.css','text/css'],'/dashboard.js':['dashboard.js','text/javascript'],'/timeline.mjs':['timeline.mjs','text/javascript'],'/storyboard.js':['storyboard.js','text/javascript'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],'/icon.svg':['icon.svg','image/svg+xml'],'/sw.js':['sw.js','text/javascript']};
 async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>300000)throw new Error('Request is too large.');}return s?JSON.parse(s):{};}
 const json=(res,status,data)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(data));
 const packet=id=>({...store.publicData(id),csrf,sceneIndex:buildScenes(store.character(id)).map(({id,title,start,end,startTime,endTime})=>({id,title,start,end,startTime,endTime})),
   liveNextAt:nextLiveAt,liveChecking:liveChecking===id,serverTime:Date.now(),
   sceneImageEnabled:!demo&&Boolean(process.env.OPENAI_API_KEY),sceneImageBusy:sceneRequests.has(id),
   watchers:[...watchers.values()].filter(x=>x.profileId===id).map(({timer,...x})=>x)});
 async function runAgent(p,text,purpose='chat'){
   const c=store.character(p.id);if(c.agentStatus==='working')throw new Error('This character already has a response in progress.');
   const source={location:c.state?.here?.id,entity:p.entityId,cursor:c.state?.cursor};
   c.stopRequested=false;c.agentStatus='working';c.agentProgress=0;c.agentPreview='';c.messages.push({id:randomUUID(),timelineSeq:c.state?.cursor||0,role:'user',mode:purpose==='game'?'game':'chat',text,time:new Date().toISOString()});await store.save();
   (async()=>{try{
     let answer;
     if(purpose==='game'){
       const reply=await runGameTurn({profile:p,character:c,text,game,execute,save:()=>store.save(),cancelled:()=>c.stopRequested,
         plan:execution=>demo?Promise.resolve(execution.results.length?{reply:'You speak: “'+text+'”',suggestions:[]}:{reply:'',suggestions:[{title:'Speak your words in the fictional preview',op:'say',argumentsJson:JSON.stringify({text})}]}):agent.reply(p,text,'game',undefined,execution)});
       c.messages.push({id:randomUUID(),timelineSeq:c.state?.cursor||0,role:'assistant',mode:'game',text:reply,time:new Date().toISOString()});c.agentStatus='idle';return;
     }
     if(demo){const s=c.state;answer={reply:purpose==='atlas'?'I have charted the routes recorded in this fictional scene. This is a schematic, not a scale map.':'Sera is waiting at the gate, and the road is open. I could ask her about the lights, or examine the scout’s note before deciding.',suggestions:purpose==='atlas'?[]:[{title:'Ask Sera about the lights',reason:'She witnessed them from the road.',op:'say',argumentsJson:JSON.stringify({text:'Where did you see the three lights stop?',to:'sera'})}],map:purpose==='atlas'?{title:'Roads around '+s.here.name,description:text,nodes:[{id:s.here.id,label:s.here.name,x:50,y:50,note:'Current location'},...s.exits.map((e,i)=>({id:e.to,label:e.name,x:50+36*Math.cos(i*Math.PI*2/s.exits.length),y:50+36*Math.sin(i*Math.PI*2/s.exits.length),note:e.locked?'Locked route':'Observed exit'}))],edges:s.exits.map(e=>({from:s.here.id,to:e.to,uncertain:false}))}:null};}
     else answer=await agent.reply(p,text,purpose,t=>{c.agentProgress=t.length;const m=t.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/s);if(m){try{c.agentPreview=JSON.parse('"'+m[1].replace(/\\$/,'')+'"');}catch{}}});
     c.messages.push({id:randomUUID(),timelineSeq:c.state?.cursor||0,mode:'chat',role:'assistant',text:answer.reply,time:new Date().toISOString()});
     for(const proposal of (answer.suggestions||[]).slice(0,12)){try{const args=JSON.parse(proposal.argumentsJson);if(!['act','say','remember','intend'].includes(proposal.op))continue;validateOperation(proposal.op,args);c.suggestions.push({id:randomUUID(),title:proposal.title,reason:proposal.reason,op:proposal.op,args,status:'pending',...source,created:new Date().toISOString()});}catch{}}
     if(answer.map){const m=answer.map;if(!Array.isArray(m.nodes)||m.nodes.length>100||!Array.isArray(m.edges))throw new Error('The map response was invalid.');c.maps.push({...m,id:randomUUID(),created:new Date().toISOString(),request:text,sourceCursor:c.state?.cursor,location:c.state?.here?.id});}
     c.agentStatus='idle';
   }catch(e){c.agentStatus='error';c.messages.push({id:randomUUID(),role:'error',text:e.message,time:new Date().toISOString()});}finally{c.activeThread=null;c.agentPreview='';await store.save();}})().catch(()=>{c.agentStatus='error';c.messages.push({id:randomUUID(),role:'error',text:'The local record could not be saved. Check folder access before continuing.',time:new Date().toISOString()});});
 }
 async function startRecap(p,options={}){
   const c=store.character(p.id);
   if(c.agentStatus==='working'||storyJobs.has(p.id))throw new Error('Wait for the current response or stop it first.');
   const snapshot=c.events.slice();
   let events=snapshot;
   if(options.scene){
     const scene=buildScenes(c).find(item=>item.id===String(options.scene));
     if(!scene)throw new Error('This scene is no longer available. Refresh the storyboard.');
     events=sceneEvidence(c,scene).events;
   }else if(options.range==='unread'||!options.range){
     events=events.filter(event=>event.seq>(c.lastReadSeq||0));
   }else if(options.range==='day'){
     const latest=snapshot.at(-1)?.t||0;
     events=events.filter(event=>event.t>=latest-86400);
   }else if(options.range!=='all')throw new Error('Choose a recap period.');
   if(c.historyCoverage?.pending)throw new Error('History is still catching up. Try again after the next sync.');
   const job={id:randomUUID(),status:'working',scene:options.scene||null,start:events[0]?.seq||0,
     end:events.at(-1)?.seq||0,range:options.range||'unread',count:events.length,coverage:coverageText(c),created:new Date().toISOString()};
   c.recapJob=job;c.stopRequested=false;c.agentStatus='working';storyJobs.add(p.id);
   try{await store.save();}catch(error){storyJobs.delete(p.id);c.agentStatus='idle';job.status='error';job.error=error.message;throw error;}
   (async()=>{
     try{
       const text=await summarizeHistory({
         character:c,events,cancelled:()=>c.stopRequested,save:()=>store.save(),
         question:options.scene?'Analyze all the supplied scene logs, then reflect in the character’s inner voice. Write a short prose summary of 80–150 words in one or two paragraphs, without headings or bullet points. Focus on what happened, what changed, and what remains uncertain. Cite supporting events.':options.question||'Tell the story of this interval in chronological order. Include changes for my character, who arrived or left, important dialogue and unresolved matters. Cite every factual paragraph.',
         progress:message=>{job.progress=message;c.agentPreview=message;},
         ask:async(question,evidence)=>demo?evidence.split('\n').slice(0,8).map(line=>line.split(' {')[0]).join('\n\n'):
           (await agent.reply(p,question,options.scene?'scene-summary':'recap',undefined,undefined,evidence)).reply,
       });
       if(c.stopRequested)throw new Error('Recap stopped.');
       Object.assign(job,{status:'complete',text});
       (c.recaps??=[]).push({...job});
       if(job.scene)(c.sceneNarratives??={})[job.scene]={end:job.end,text};
       c.agentStatus='idle';
     }catch(error){job.status='error';job.error=error.message;c.agentStatus='idle';}
     finally{storyJobs.delete(p.id);c.agentPreview='';c.activeThread=null;await store.save();}
   })().catch(()=>{job.status='error';job.error='The local recap could not be saved.';});
   return job;
 }
 async function execute(p,op,args,requestId,guard){
   validateOperation(op,args);const c=store.character(p.id);
   if(op==='join'&&args.entity!==undefined&&args.entity!==p.entityId)throw new Error('Reconnect only the character assigned to this profile.');
   if(op==='join'&&args.template&&p.entityId)throw new Error('Create a new empty profile before creating a new game character.');
   if(!requestId||typeof requestId!=='string')throw new Error('Missing action identifier.');
   if(c.requests[requestId])return c.requests[requestId];
   c.requests[requestId]={status:'pending',message:'Submitted; do not retry until confirmed.'};await store.save();
   try{const r=await game.execute(p,op,args,guard);c.requests[requestId]={status:r.ok===false?'refused':'complete',result:r};}catch(e){c.requests[requestId]={status:'uncertain',message:e.message};}
   await store.save();return c.requests[requestId];
 }
 const server=createServer(async(req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
   const localHost='127.0.0.1:'+server.address().port,proxy=req.headers['x-forwarded-host']||req.headers['x-forwarded-proto']||req.headers['tailscale-user-login'];
   const origin=mobile&&req.headers.host===mobile.host&&req.headers['tailscale-user-login']===login?mobile.origin:req.headers.host===localHost&&!proxy?'http://'+localHost:null;
   if(!origin||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Origin not allowed.'});
   const url=new URL(req.url,origin);
   try{
     if(!url.pathname.startsWith('/api/')){const a=assets[url.pathname];if(!a||req.method!=='GET')return res.writeHead(404).end();res.writeHead(200,{'Content-Type':a[1]+'; charset=utf-8'}).end(await readFile(new URL(a[0],import.meta.url)));return;}
     if(req.headers['x-glass-reach-dashboard']!=='1')return json(res,403,{error:'Dashboard header required.'});
     if(req.method!=='GET'&&req.headers['x-csrf-token']!==csrf)return json(res,403,{error:'Reload the dashboard before submitting.'});
     const b=req.method==='GET'?{}:await body(req),id=url.searchParams.get('profile')||b.profile||store.data.profiles[0].id,p=store.profile(id),c=store.character(id),route=req.method+' '+url.pathname;
     if(route==='GET /api/session'){liveProfiles.set(p.credential,id);if(demo&&!c.state)await game.refresh(p);return json(res,200,packet(id));}
     if(route==='POST /api/refresh'){await game.refresh(p);return json(res,200,packet(id));}
     if(route==='GET /api/story'){
       return json(res,200,{...storyPage(c,{
         before:Number(url.searchParams.get('before'))||Infinity,query:(url.searchParams.get('q')||'').slice(0,300),limit:Math.min(500,Math.max(12,Number(url.searchParams.get('limit'))||12)),
       }),names:historicalNames(c),coverage:coverageText(c),lastReadSeq:c.lastReadSeq||0,
         unread:c.events.filter(event=>event.seq>(c.lastReadSeq||0)).length,latestSeq:c.events.at(-1)?.seq||0});
     }
     if(route==='GET /api/event'){
       const event=c.events.find(event=>event.seq===Number(url.searchParams.get('seq')));
       if(!event)return json(res,404,{error:'Event unavailable in the saved ledger.'});
       return json(res,200,{event,text:describeEvent(event,historicalNames(c))});
     }
     if(route==='POST /api/story/read'){
       if(c.historyCoverage?.pending)throw new Error('Wait for history to finish catching up before marking it read.');
       const seq=Number(b.through);
       if(!Number.isSafeInteger(seq)||seq<0||seq>(c.events.at(-1)?.seq||0))throw new Error('Choose a recorded position.');
       c.lastReadSeq=Math.max(c.lastReadSeq||0,seq);await store.save();
       return json(res,200,{lastReadSeq:c.lastReadSeq});
     }
     if(route==='POST /api/story/recap')return json(res,202,await startRecap(p,b));
     if(route==='POST /api/story/prose')return json(res,202,await writeSceneProse(p,b.scene));
     if(route==='POST /api/inspect')return json(res,200,await game.read(p,b.op,b.args||{}));
     if(route==='POST /api/action')return json(res,200,await execute(p,b.op,b.args,b.requestId));
     if(route==='POST /api/agent'){if(!b.text?.trim())throw new Error('Enter a request.');if(b.mode!=null&&!['chat','game'].includes(b.mode))throw new Error('Choose Talk to Codex or Act in game.');if(b.mode!=='game'&&/catch me up|what (?:did i miss|changed)|summari[sz]e.*(?:missed|recent|events)/i.test(b.text)){return json(res,202,await startRecap(p,{range:'unread',question:b.text}));}await runAgent(p,b.text,b.mode==='game'?'game':['atlas','suggestions'].includes(b.purpose)?b.purpose:'chat');return json(res,202,{ok:true});}
     if(route==='POST /api/agent/connect')return json(res,200,demo?{connected:true,demo:true,models:[]}:await agent.start());
     if(route==='POST /api/agent/stop'){c.stopRequested=true;await agent.stopThread(c.activeThread);return json(res,200,{ok:true});}
     if(route==='POST /api/agent/reset'){if(c.agentStatus==='working')throw new Error('Stop the current reply first.');c.sessions??=[];c.sessions.push({time:new Date().toISOString(),messages:c.messages});c.messages=[];c.threadId=null;await store.save();return json(res,200,packet(id));}
     if(route==='POST /api/settings'){
       if(typeof b.masterPrompt==='string'&&b.masterPrompt!==store.data.masterPrompt){store.data.promptVersions.unshift({text:store.data.masterPrompt,time:new Date().toISOString()});store.data.promptVersions=store.data.promptVersions.slice(0,20);store.data.masterPrompt=b.masterPrompt;}
       if(b.modelsByPurpose&&typeof b.modelsByPurpose==='object'){store.data.modelsByPurpose=Object.fromEntries(['chat','game','prose','atlas','suggestions'].map(k=>[k,typeof b.modelsByPurpose[k]==='string'?b.modelsByPurpose[k]:'']));}
       if(typeof b.liveFeed==='boolean')p.liveFeed=b.liveFeed;
       if(typeof b.model==='string')store.data.model=b.model;if(typeof b.instructions==='string')p.instructions=b.instructions;if(['manual','suggest'].includes(b.mode))p.mode=b.mode;
       await store.save();return json(res,200,packet(id));
     }
     if(route==='POST /api/local'){for(const key of ['draft','organization','notes'])if(b[key]!==undefined)c[key]=b[key];await store.save();return json(res,200,{ok:true});}
     if(route==='POST /api/map'){const m=b.map;if(!m||!Array.isArray(m.nodes)||m.nodes.length>100||!Array.isArray(m.edges))throw new Error('Invalid map.');c.maps.push({...m,id:randomUUID(),created:new Date().toISOString(),sourceCursor:c.state?.cursor,location:c.state?.here?.id});await store.save();return json(res,200,{ok:true});}
     if(route==='POST /api/scene-image'){
       const key=process.env.OPENAI_API_KEY;
       if(demo||!key)throw new Error('Scene generation needs an OpenAI API key on the live dashboard server.');
       if(sceneRequests.has(id))throw new Error('An image for this character is already generating.');
       const observation=c.state,description=typeof b.description==='string'?b.description.trim():'';
       if(!observation?.here || observation.you?.id!==p.entityId)throw new Error('Sync this character before requesting an image.');
       if(description.length>2000)throw new Error('Keep scene instructions under 2,000 characters.');
       sceneRequests.add(id);
       try{
         const png=await imageGenerator({key,description,observation});
         const scene={id:randomUUID(),title:observation.here.name,description,created:new Date().toISOString()};
         await mkdir(sceneDir,{recursive:true});
         await writeFile(join(sceneDir,scene.id+'.png'),png,{flag:'wx'});
         (c.sceneImages??=[]).push(scene);
         try{await store.save();}catch(error){c.sceneImages.pop();throw error;}
         return json(res,201,scene);
       }finally{sceneRequests.delete(id);}
     }
     if(route==='GET /api/scene-image'){
       const scene=c.sceneImages?.find(entry=>entry.id===url.searchParams.get('id'));
       if(!scene||!/^[0-9a-f-]{36}$/.test(scene.id))return json(res,404,{error:'Scene image not found.'});
       const png=await readFile(join(sceneDir,scene.id+'.png'));
       return res.writeHead(200,{'Content-Type':'image/png'}).end(png);
     }
     if(route==='POST /api/profiles'){
       if(!b.name?.trim())throw new Error('Give this character profile a name.');
       const pid=randomUUID(),profile={id:pid,name:b.name.trim(),entityId:b.entityId?.trim()||'',instructions:'',mode:'manual',credential:b.token?pid:p.credential};
       if(b.token&&!demo){const r=await game.transport(profile,'',{token:b.token},true);if(!r.ok)throw new Error('Could not protect the credential.');}
       store.data.profiles.push(profile);store.character(pid);if(demo)await game.refresh(profile);await store.save();return json(res,200,{id:pid});
     }
     if(route==='POST /api/suggestion'){
       const q=c.suggestions.find(x=>x.id===b.id);if(!q)throw new Error('Suggestion not found.');if(q.status!=='pending')throw new Error('This suggestion has already been handled.');
       if(b.dismiss){q.status='dismissed';await store.save();return json(res,200,{ok:true});}
       if(q.entity!==p.entityId)throw new Error('Suggestion belongs to a different character.');q.status='reviewing';await store.save();
       try{await game.refresh(p);}catch(e){q.status='pending';await store.save();throw e;}
       if(!demo&&c.state?.connection!=='Live'){q.status='pending';await store.save();throw new Error('Reconnect before approving.');}
       if(q.location!==c.state?.here?.id){q.status='stale';await store.save();throw new Error('The character has moved. Prepare a new suggestion for this location.');}
       const args=b.args||q.args;try{validateOperation(q.op,args);}catch(e){q.status='pending';await store.save();throw e;}q.status='executing';await store.save();const r=await execute(p,q.op,args,'suggestion-'+q.id);q.status=r.status;await store.save();return json(res,200,r);
     }
     if(route==='POST /api/readied'){
       const rules=c.readied??=[];
       const current=rules.find(rule=>rule.id===b.id);
       function checkRevision(){
         if(b.id&&(!current || !rules.includes(current) || savingReadied.has(current) || current.revision!==b.revision || current.status!=='armed')){
           throw new Error('This readied action changed. Reload it before editing or disarming.');
         }
       }
       checkRevision();
       if(b.disarm){
         if(!current)throw new Error('Choose an armed action to disarm.');
         current.status='cancelled';current.outcome='Disarmed by you.';
         await store.save();
         return json(res,200,packet(id));
       }
       const approved=prepareReadied(b);
       const approvalId=typeof b.approvalId==='string'&&/^[a-f0-9-]{36}$/.test(b.approvalId)?b.approvalId:randomUUID();
       if(!b.id && rules.some(rule=>rule.id===approvalId))return json(res,200,packet(id));
       await game.refresh(p);
       checkRevision();
       if(!current&&rules.filter(rule=>rule.status==='armed').length>=12)throw new Error('Disarm a readied action before adding another. The limit is 12 per character.');
       const state=c.state;
       if((!demo&&state?.connection!=='Live') || !state?.here || state.you?.id!==p.entityId){
         throw new Error('Reconnect this character before arming an action.');
       }
       if(state.here.id!==b.location || state.world!==b.world || p.entityId!==b.entity){
         throw new Error('The character or scene changed. Review the command again.');
       }
       const now=Date.now();
       if(!b.id&&rules.some(rule=>rule.id===approvalId))return json(res,200,packet(id));
       const rule={
         ...approved,id:current?.id||approvalId,revision:randomUUID(),status:'armed',
         location:state.here.id,locationName:state.here.name,world:state.world,entity:p.entityId,credential:p.credential,
         since:Math.max(state.cursor||0,c.events.at(-1)?.seq||0),expires:now+approved.minutes*60000,
       };
       // Claim the revision synchronously, then persist the approved command before it can fire.
       const index=current?rules.indexOf(current):rules.length;
       savingReadied.add(rule);
       rules[index]=rule;
       try{await store.save();}catch(error){
         if(current)rules[index]=current;
         else rules.splice(index,1);
         throw error;
       }finally{savingReadied.delete(rule);}
       return json(res,200,packet(id));
     }
     if(route==='POST /api/watch'){
       if(b.stop){const w=watchers.get(b.stop);if(w?.profileId===id){clearTimeout(w.timer);watchers.delete(b.stop);}return json(res,200,{ok:true});}
       if([...watchers.values()].some(w=>w.profileId===id&&w.status==='watching'))throw new Error('Stop the current watch before setting another.');
       const kind=b.kind,value=String(b.value||'').slice(0,100);if(!['arrival','reply','water','dusk'].includes(kind))throw new Error('Choose a watch condition.');
       const expression=kind==='arrival'?`came(${JSON.stringify(value)})`:kind==='reply'?`heard('', by=${JSON.stringify(value)})`:kind==='water'?"me['water'] <= 3":"ambient.get('time_of_day') == 'dusk'";
       const w={id:randomUUID(),profileId:id,kind,value,status:'watching',started:new Date().toISOString(),timer:null};watchers.set(w.id,w);
       async function poll(){if(!watchers.has(w.id))return;try{const r=demo?{fired:kind==='dusk'}:await game.serial(p,async()=>{await game.assertCharacter(p);return game.transport(p,'wait',{until:expression,timeout:10,since:c.state?.cursor||0});});if(!watchers.has(w.id))return;if(r.ok===false)throw new Error(r.reason);if(r.fired){w.status='fired';c.messages.push({id:randomUUID(),timelineSeq:c.state?.cursor||0,role:'notice',text:'Watch triggered: '+kind+' '+value,time:new Date().toISOString()});await game.refresh(p);await store.save();return;}}catch(e){w.status='error';w.error=e.message;return;}w.timer=setTimeout(poll,3000);}
       w.timer=setTimeout(poll,100);return json(res,200,{ok:true});
     }
     if(route==='GET /api/history'){const before=Number(url.searchParams.get('before'))||Infinity;return json(res,200,c.events.filter(e=>e.seq<before).slice(-500));}
     if(route==='GET /api/export')return json(res,200,{...packet(id),events:c.events,csrf:undefined,profiles:undefined});
     return json(res,404,{error:'Unknown endpoint.'});
   }catch(e){json(res,400,{error:e.message});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const background=setInterval(async()=>{for(const p of store.data.profiles){const c=store.character(p.id);if(p.mode!=='suggest'||c.agentStatus==='working'||Date.now()-(c.lastSuggestedAt||0)<300000)continue;try{await game.refresh(p);if(c.state?.connection==='Saved observation')continue;if(c.lastSuggestedCursor===c.state?.cursor)continue;c.lastSuggestedCursor=c.state.cursor;c.lastSuggestedAt=Date.now();await runAgent(p,'Review the current situation and prepare up to three useful next actions for my approval. Do not repeat pending suggestions.','suggestions');}catch{}}},60000);background.unref();
 let liveBusy=false;
 nextLiveAt=Date.now()+liveIntervalMs;
 const liveTimer=setInterval(async()=>{
   nextLiveAt=Date.now()+liveIntervalMs;
   if(liveBusy)return;liveBusy=true;
   const active=new Set(liveProfiles.values());
   const armed=store.data.profiles.filter(p=>store.character(p.id).readied?.some(rule=>rule.status==='armed')).map(p=>p.id);
   try{for(const id of new Set([...active,...armed])){
     const p=store.profile(id),c=store.character(id);
     if(c.agentStatus!=='working' && (armed.includes(id) || p.liveFeed!==false)){
       liveChecking=id;
       try{await game.refresh(p);}catch{/* Retry on the next interval. */}
       finally{liveChecking=null;}
     }
     try{await runReadied({profile:p,character:c,store,execute,demo,saving:savingReadied});}catch{/* Leave any interrupted delivery unconfirmed. */}
   }}finally{liveBusy=false;}
 },liveIntervalMs);liveTimer.unref();
 const stop=()=>{clearInterval(liveTimer);clearInterval(background);for(const w of watchers.values())clearTimeout(w.timer);watchers.clear();agent.close();server.close();};
 const url='http://127.0.0.1:'+server.address().port+'/';console.log((demo?'Demo':'Glass Reach')+': '+url);return {server,store,game,agent,url,stop};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=await startServer({demo:process.argv.includes('--demo'),port:Number(process.env.PORT)||undefined});if(process.argv.includes('--open'))execFile('rundll32.exe',['url.dll,FileProtocolHandler',app.url],{windowsHide:true});process.on('SIGINT',()=>{app.stop();process.exit();});process.on('SIGTERM',()=>{app.stop();process.exit();});}
