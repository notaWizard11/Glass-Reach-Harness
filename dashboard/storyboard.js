import {storyRows} from './timeline.mjs';
export function mountStoryboard({api,getData,getProfile,onError,openDetails,reload}){
  const $=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const item=document.createElement(tag);if(text!=null)item.textContent=text;if(cls)item.className=cls;return item;};
  const button=(text,action)=>{const item=node('button',text);item.type='button';item.onclick=()=>Promise.resolve().then(action).catch(onError);return item;};
  let presencePending=false;
  const presence=node('div',null,'presence-controls'),presenceStatus=node('span'),presenceNote=node('span',null,'caption');
  const presenceButton=button('Set Away',async()=>{
    if(presencePending)return;
    presencePending=true;presenceButton.disabled=true;
    try{
      const away=getData()?.awayBookmarks?.some(b=>b.status==='away');
      await api('story/presence',{status:away?'active':'away'},getProfile());
      await reload();
      presenceNote.textContent=away?'Return bookmarked. Your highlights will appear here.':'Departure bookmarked. Live collection continues when enabled.';
      setView('story');
    }finally{presencePending=false;presenceButton.disabled=false;}
  });
  const retryReturn=button('Retry away summary',async()=>{
    const failed=[...(getData()?.awayBookmarks||[])].reverse().find(b=>b.status==='error');
    if(failed){await api('story/presence',{retry:failed.id},getProfile());await reload();}
  });
  retryReturn.hidden=true;presence.append(presenceStatus,presenceButton,retryReturn,presenceNote);
  document.querySelector('.story-controls').prepend(presence);
  let activeProfile,signature='',requestVersion=0,scenes=[],pageInfo,query='',searchTimer,view='story';
  const collapsedScenes=new Set();
  let nextProseAt=0;
  const proseControl=node('label',null,'auto-prose-control'),proseToggle=node('input');
  proseToggle.type='checkbox';proseToggle.checked=localStorage.getItem('gr-auto-prose')!=='false';
  proseToggle.onchange=()=>localStorage.setItem('gr-auto-prose',String(proseToggle.checked));
  proseControl.append(proseToggle,document.createTextNode('Auto prose'));
  proseControl.title='Use Codex to write scene passages as new records arrive. Choose its model in Settings → Auto prose.';
  $('storyboard-view').prepend(proseControl);
  const time=t=>Number.isFinite(t)?'Day '+(Math.floor(t/86400)+1)+' · '+String(Math.floor(t%86400/3600)).padStart(2,'0')+':'+String(Math.floor(t%3600/60)).padStart(2,'0'):'Time unrecorded';

  function narrative(text){
    const content=node('div',null,'scene-narrative');
    const refs=[...new Set([...text.matchAll(/\[#(\d+)\]/g)].map(match=>match[1]))];
    for(const paragraph of text.split(/\n\s*\n|\n(?=\s*[-*•] )/)){
      content.append(node('p',paragraph.replace(/\[#\d+\]/g,'').replace(/ {2,}/g,' ').trim()));
    }
      if(refs.length){
        const sources=node('details',null,'scene-sources');sources.append(node('summary','Sources'));
        const selected=getProfile();
        for(const ref of refs){const link=button('#'+ref,async()=>{const record=await api('event?seq='+ref,undefined,selected);openDetails(record.text,record.event);});link.className='quiet source-link';sources.append(link);}
        content.append(sources);
      }
    return content;
  }
  function setView(next){
    view=next;
    $('storyboard-view').hidden=next!=='story';
    $('detail-log-view').hidden=next!=='detail';
    $('story-view-button').setAttribute('aria-pressed',String(next==='story'));
    $('detail-view-button').setAttribute('aria-pressed',String(next==='detail'));
    localStorage.setItem('gr-story-view',next);
  }
  $('story-view-button').onclick=()=>setView('story');
  $('detail-view-button').onclick=()=>setView('detail');
  setView(localStorage.getItem('gr-story-view')==='detail'?'detail':'story');

  function renderScenes(){
    const root=$('story-scenes'),expanded=new Set([...root.querySelectorAll('details[open]')].map(item=>item.dataset.scene));
    root.replaceChildren();
    for(const scene of [...scenes].sort((a,b)=>b.start-a.start)){
      const shell=node('article',null,'scene-card');
      const card=node('div',null,'scene-card-body');
      card.id='scene-body-'+scene.id;card.hidden=collapsedScenes.has(scene.id);
      const head=node('div',null,'scene-card-heading');
      const title=button(scene.title,()=>{card.hidden=!card.hidden;title.setAttribute('aria-expanded',String(!card.hidden));if(card.hidden)collapsedScenes.add(scene.id);else collapsedScenes.delete(scene.id);});
      title.className='scene-title-toggle';title.setAttribute('aria-expanded',String(!card.hidden));title.setAttribute('aria-controls',card.id);
      const heading=node('h3');heading.append(title);
      const selected=getProfile();
      const summarize=button('Summarize',async()=>{
        await api('story/recap',{scene:scene.id},selected);
        collapsedScenes.delete(scene.id);card.hidden=false;title.setAttribute('aria-expanded','true');
        $('recap-status').textContent='Reflecting on this scene…';
      });
      summarize.className='scene-summarize';summarize.disabled=getData()?.agentStatus==='working';
      head.append(heading,summarize,node('small',time(scene.startTime)+' — '+time(scene.endTime)));
      shell.append(head,card);
      if(scene.prose)card.append(narrative(scene.prose));
      if(!scene.proseFresh){
        const job=getData()?.storyProseJob;
        const pending=job?.scene===scene.id&&job.status==='working';
        const error=job?.scene===scene.id&&job.status==='error'?job.error:null;
        card.append(node('p',error?'Scene prose unavailable: '+error:pending?'Writing this scene…':scene.prose?'New events are waiting to be woven into this passage.':'The scene passage is waiting to be written. Open the record below to read events now.','caption'));
        if(!proseToggle.checked||error)card.append(button('Write scene',async()=>{await api('story/prose',{scene:scene.id},selected);signature='';}));
      }
      if(scene.summary){const reflection=node('aside',null,'scene-reflection');reflection.append(node('small','Inner reflection'),narrative(scene.summary));card.append(reflection);}
      const records=node('details');
      records.dataset.scene=scene.id;records.open=expanded.has(scene.id);
      const exchanges=(getData()?.messages||[]).filter(message=>message.timelineSeq>=scene.start&&message.timelineSeq<=scene.end);
      const rows=storyRows(scene.events,exchanges);
      records.append(node('summary','Scene record · '+rows.length+' entries'));
      if(scene.participants.length)records.append(node('p',scene.participants.join(' · '),'caption'));
      for(const entry of rows){
        const row=node('div',null,'scene-record story-entry');row.dataset.kind=entry.category;
        if(entry.event){
          const event=entry.event,line=scene.lines.find(line=>line.seq===event.seq);
          row.append(node('small',time(event.t)+' · #'+event.seq+' · '+entry.label),node('p',line?.text||event.kind));
          row.append(button('Details',()=>openDetails(line?.text||event.kind,event)));
        }else row.append(node('small',entry.label),node('p',entry.message.text));
        records.append(row);
      }
      card.append(records);
      root.append(shell);
    }
    if(!scenes.length)root.append(node('p',query?'No scenes match this search.':'Your scenes will appear when game events arrive.','empty'));
    $('story-older').hidden=!pageInfo?.more;
  }
  async function loadScenes(older=false){
    const selected=getProfile(),version=++requestVersion;
    const before=older&&scenes.length?'&before='+scenes[0].start:'';
    try{
      const result=await api('story?q='+encodeURIComponent(query)+before+(!older?'&limit='+Math.max(12,scenes.length):''),undefined,selected);
      if(version!==requestVersion||getProfile()!==selected)return;
      pageInfo=result;
      scenes=older?[...result.scenes,...scenes]:[...scenes.filter(scene=>scene.start<(result.scenes[0]?.start||0)),...result.scenes];
      $('story-coverage').textContent=result.coverage;
      $('story-unread').textContent=result.lastReadSeq?result.unread+' unread events':result.total+' events · no read position set';
      $('story-mark-read').disabled=!result.latestSeq||Boolean(getData()?.historyCoverage?.pending);
      renderScenes();
    }catch(error){if(version===requestVersion)$('story-coverage').textContent=error.message;}
  }
  $('story-older').onclick=()=>loadScenes(true);
  $('story-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=$('story-search').value.trim();scenes=[];loadScenes();},300);};
  $('story-mark-read').onclick=async()=>{
    if(!pageInfo)return;
    const through=scenes.at(-1)?.end||0;
    try{await api('story/read',{through});signature='';await loadScenes();}catch(error){onError(error);}
  };
  $('catch-up').onclick=async()=>{
    try{
      await api('story/recap',{range:$('recap-range').value});
      $('recap-status').textContent='Reading saved history…';
      setView('story');
    }catch(error){onError(error);}
  };
  let recapSignature='';
  function update(){
    const data=getData();if(!data)return;
    const bookmarks=data.awayBookmarks||[],away=bookmarks.find(b=>b.status==='away'),latest=bookmarks.at(-1);
    presenceStatus.textContent=away?'Away since '+new Date(away.awayAt).toLocaleString():'Active';
    presenceButton.textContent=away?'Return to Active · summarize':'Set Away';
    presenceButton.disabled=presencePending;
    retryReturn.hidden=!bookmarks.some(b=>b.status==='error');
    presenceNote.textContent=away?'Your departure is bookmarked. Returning summarizes only this absence.':latest?.status==='queued'?'Return bookmarked · briefing queued until Codex and history are ready.':latest?.status==='summarizing'?'Preparing the high points from your absence…':latest?.status==='error'?'Summary failed: '+latest.error:latest?.status==='complete'?'Your away briefing is saved below.':'Mark your departure, then return for an automatic highlights briefing. This does not change game behaviour or autopilot.';
    if(activeProfile!==getProfile()){
      activeProfile=getProfile();signature='';recapSignature='';scenes=[];pageInfo=null;
      collapsedScenes.clear();
      query='';$('story-search').value='';
    }
    if(proseToggle.checked&&view==='story'&&!document.hidden&&data.agentStatus!=='working'&&!data.historyCoverage?.pending&&data.storyProseJob?.status!=='working'&&Date.now()>nextProseAt){
      const pending=[...scenes].reverse().find(scene=>!scene.proseFresh);
      if(pending){nextProseAt=Date.now()+30000;api('story/prose',{scene:pending.id}).then(()=>{signature='';}).catch(error=>{$('recap-status').textContent=error.message;});}
    }
    const next=JSON.stringify([activeProfile,data.events?.[0]?.seq,data.events?.at(-1)?.seq,data.lastReadSeq,data.historyCoverage,data.recapJob?.status,data.storyProseJob,data.agentStatus,data.messages?.length]);
    if(signature!==next){signature=next;loadScenes();}
    const job=data.recapJob;
    $('catch-up').disabled=data.agentStatus==='working';
    $('recap-status').textContent=job?.status==='working'?job.progress||'Reading history…':job?.status==='error'?job.error:'';
    const recaps=data.recaps||[];
    const nextRecaps=JSON.stringify([activeProfile,recaps]);
    if(nextRecaps!==recapSignature){
      recapSignature=nextRecaps;
      $('saved-recaps').replaceChildren();
      for(const recap of [...recaps].reverse().filter(recap=>!recap.scene)){
        const card=node('details',null,'recap-card');
        card.open=recap.id===job?.id;
        card.append(node('summary',(recap.bookmark?'While you were away':'Catch-up highlights')+' · '+new Date(recap.created).toLocaleString()));
        if(recap.bookmark)card.append(node('p',new Date(recap.awayAt).toLocaleString()+' → '+new Date(recap.returnedAt).toLocaleString(),'caption'));
        card.append(node('p',recap.coverage,'caption'),narrative(recap.text));
        if(recap.end){
          const selected=activeProfile;
          card.append(button('Caught up through this recap',async()=>{
            await api('story/read',{through:recap.end},selected);signature='';await loadScenes();
          }));
        }
        $('saved-recaps').append(card);
      }
    }
  }
  return {update,catchUp:()=>{$('catch-up').click();}};
}
