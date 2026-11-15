export function mountRules({api,getData,getProfile,reload,onError}){
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,action)=>{const b=make('button',text);b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(onError);return b;};
 const detail=(title,text)=>{const d=make('details'),p=make('pre',text,'prompt-preview');d.append(make('summary',title),p);return d;};
 const nav=make('button','↻ Rules & updates');nav.dataset.page='rules';document.querySelector('.navigation').append(nav);
 const page=make('section',null,'page');page.id='page-rules';page.hidden=true;
 page.append(make('h1','Rules & updates'),make('p','Engine mechanics are synced automatically when the world reports a new rules version. Reading the engine feed acknowledges it there; Seen below is your separate reading marker.'));
 const releasePanel=make('section',null,'panel harness-updates'),releaseStatus=make('p',null,'caption'),releaseList=make('div');
 releasePanel.append(make('h2','Harness updates'),make('p','Feature and fix notes from this installed build. Unreleased entries are development notes; this does not check for or install a newer version.','caption'));
 const releaseControls=make('div',null,'inline'),sourceLink=make('a','View changelog source');sourceLink.href='/CHANGELOG.md';sourceLink.target='_blank';sourceLink.rel='noopener';
 releaseControls.append(button('Reload harness notes',()=>loadNotes()),sourceLink);releasePanel.append(releaseControls,releaseStatus,releaseList);page.append(releasePanel,make('h2','Engine rules'));
 let notesLoading=false,notesLoaded=false;
 async function loadNotes(){if(notesLoading)return;notesLoading=true;releaseStatus.textContent='Loading harness notes…';try{const result=await api('harness-updates');releaseList.replaceChildren();for(const [index,section]of result.sections.entries()){const item=make('details',null,'release-note');item.open=index===0;item.append(make('summary',section.title));const list=make('ul');for(const note of section.notes)list.append(make('li',note));item.append(list);releaseList.append(item);}notesLoaded=true;releaseStatus.textContent=result.sections.length?'Same source as the repository changelog.':'No release notes recorded yet.';}catch(error){releaseStatus.textContent='Harness notes unavailable: '+error.message;}finally{notesLoading=false;}}
 const controls=make('div',null,'inline'),status=make('p'),feed=make('div'),reviews=make('div');
 controls.append(button('Check engine rules',async()=>{status.textContent='Checking engine rules…';await api('rules/sync',{});await reload();}),button('Mark engine updates seen',async()=>{await api('rules/seen',{});await reload();}),button('Review rules & propose prompt updates',async()=>{await api('rules/review',{});await reload();}));
 page.append(controls,status,make('p','Rules inform agent context automatically. Prompt proposals are never applied automatically. A rule may also require code changes to watches, automation or the character sheet; editing a prompt cannot implement those changes.','caption'),reviews,feed);
 document.getElementById('page-settings').before(page);
 const panel=make('section',null,'panel prompt-list-panel');panel.append(make('h2','Master Prompts List'),make('p','The shared Master prompt and character additions below apply to every Codex query. Expand a type to edit its actual role instructions and automatic task prompt. Context options control direct requests; selected evidence, current observations and execution permissions remain enforced. Saved changes affect subsequent model requests.'));
 const list=make('div'),loadStatus=make('p');panel.append(button('Reload saved prompt list',()=>loadPrompts()),loadStatus,list);
 document.getElementById('page-settings').querySelector('.two-column').before(panel);
 let profileKey='',rulesKey='',loading=false,catalogue;
 async function loadPrompts(){
  if(loading)return;loading=true;loadStatus.textContent='Loading prompts…';const selected=getProfile();
  try{const result=await api('prompts',undefined,selected);if(selected!==getProfile())return;catalogue=result;list.replaceChildren();
   for(const item of result.entries){
    const card=make('details',null,'prompt-card');card.append(make('summary',item.name+(item.customized?' · customized':'')));
    const instructions=make('textarea');instructions.rows=8;instructions.value=item.instructions;
    const task=make('textarea');task.rows=4;task.value=item.task;
    const label=(text,input)=>{const l=make('label',text);l.append(input);card.append(l);};
    label('Role instructions',instructions);label('Automatic task prompt (blank for a direct user request)',task);
    card.append(make('p',item.contextDescription,'caption'));
    const context={...item.context},options=make('div',null,'prompt-context');
    const evidenceOnly=['scene-story','scene-summary','recap','quests','rules-review'].includes(item.key);
    for(const [key,value] of Object.entries(context)){
     const l=make('label',key.replace(/([A-Z])/g,' $1')),input=make('input');
     if(typeof value==='boolean'){input.type='checkbox';input.checked=value;input.onchange=()=>context[key]=input.checked;}
     else{input.type='number';input.min=0;input.max=key==='recentEvents'?200:50;input.value=value;input.oninput=()=>context[key]=Number(input.value);}
     input.disabled=evidenceOnly;l.append(input);options.append(l);
    }
    card.append(options);
    const notice=make('span',null,'caption');
    card.append(button('Save this prompt',async()=>{if(selected!==getProfile())throw new Error('Character selection changed. Reload the prompt list.');await api('prompts',{key:item.key,revision:item.revision,value:{instructions:instructions.value,task:task.value,context}},selected);await loadPrompts();await reload();}),notice);
    if(item.history.length){const history=make('select');history.append(make('option','Restore an earlier version into editor…'));item.history.forEach((entry,i)=>{const option=make('option',new Date(entry.time).toLocaleString());option.value=String(i);history.append(option);});history.onchange=()=>{const old=item.history[Number(history.value)]?.value;if(old){instructions.value=old.instructions;task.value=old.task;notice.textContent='Earlier text loaded. Save to apply. Context options remain as displayed.';}};card.append(history);}
    card.append(detail('Effective saved instructions (including shared preferences)',item.baseInstructions+'\n\n'+item.effectiveInstructions),detail('Engine rules supplied as context',result.rules));list.append(card);
   }
   list.append(make('p','Notification watches and readied actions use their configured conditions and exact approved commands, not an LLM prompt. Atlas scene images use a separate image-generation prompt and API.','caption'));
   loadStatus.textContent='Saved prompts loaded. Drafts stay in the editor until saved or reloaded.';
  }catch(error){loadStatus.textContent=error.message;}finally{loading=false;}
 }
 function update(){
  const data=getData();if(!data)return;
  if(!notesLoaded&&!notesLoading){notesLoaded=true;loadNotes();}
  if(profileKey!==getProfile()){profileKey=getProfile();loadPrompts();rulesKey='';}
  const f=data.rulesFeed,review=data.rulesReview;
  const key=JSON.stringify([profileKey,f,review]);if(key===rulesKey)return;rulesKey=key;
  nav.textContent='↻ Rules & updates'+(f&&f.version>(f.seenVersion||0)?' ●':'');
  status.textContent=!f?'No engine rules cached yet. Check for updates.':'Downloaded v'+f.version+' · '+(f.pending?'More pages pending · ':'')+(f.error?'Sync error: '+f.error:'Available to agent context')+' · '+(f.checkedAt?new Date(f.checkedAt).toLocaleString():'')+' · Seen through v'+(f.seenVersion||0);
  feed.replaceChildren();for(const entry of [...(f?.pages||[])].reverse()){const d=detail('Engine changes · v'+(entry.since+1)+'–'+entry.through,entry.text);d.open=entry.through>(f.seenVersion||0);feed.append(d);}
  reviews.replaceChildren();if(review){reviews.append(make('h2','Prompt review'),make('p',review.status==='working'?'Codex is reviewing rules and prompt preferences…':review.status==='error'?review.error:review.reply));
   for(const proposal of review.proposals||[]){const card=make('section',null,'prompt-proposal');card.append(make('h3',proposal.key+' · '+proposal.status),make('p',proposal.reason),detail('Current at review',typeof proposal.before==='string'?proposal.before:proposal.before.instructions+'\n\nTask: '+proposal.before.task),detail('Proposed replacement',proposal.instructions+'\n\nTask: '+proposal.task));
    if(proposal.status==='pending'){const selected=getProfile();card.append(button('Apply proposed change',async()=>{await api('rules/proposal',{id:proposal.id},selected);await reload();await loadPrompts();}),button('Dismiss',async()=>{await api('rules/proposal',{id:proposal.id,dismiss:true},selected);await reload();}));}reviews.append(card);}
  }
 }
 return {update};
}
