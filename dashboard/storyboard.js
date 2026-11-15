import {storyRows} from './timeline.mjs';
export function mountStoryboard({api,getData,getProfile,onError,openDetails}){
  const $=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const item=document.createElement(tag);if(text!=null)item.textContent=text;if(cls)item.className=cls;return item;};
  const button=(text,action)=>{const item=node('button',text);item.type='button';item.onclick=()=>Promise.resolve().then(action).catch(onError);return item;};
  let activeProfile,signature='',requestVersion=0,scenes=[],pageInfo,query='',searchTimer,view='story';
  const time=t=>Number.isFinite(t)?'Day '+(Math.floor(t/86400)+1)+' · '+String(Math.floor(t%86400/3600)).padStart(2,'0')+':'+String(Math.floor(t%3600/60)).padStart(2,'0'):'Time unrecorded';

  function narrative(text){
    const content=node('div',null,'scene-narrative');
    for(const paragraph of text.split(/\n\s*\n/)){
      const p=node('p');
      for(const part of paragraph.split(/(\[#\d+\])/g)){
        const reference=part.match(/^\[#(\d+)\]$/);
        if(reference){
          const selected=getProfile();
          const link=button('#'+reference[1],async()=>{
            const record=await api('event?seq='+reference[1],undefined,selected);
            openDetails(record.text,record.event);
          });
          link.className='quiet source-link';link.title='Open the recorded event';
          p.append(link);
        }else p.append(document.createTextNode(part));
      }
      content.append(p);
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
    for(const scene of scenes){
      const card=node('article',null,'scene-card');
      const head=node('div',null,'scene-card-heading');
      head.append(node('h3',scene.title),node('small',time(scene.startTime)+' — '+time(scene.endTime)));
      card.append(head);
      if(scene.participants.length)card.append(node('p',scene.participants.join(' · '),'caption'));
      if(scene.summary)card.append(narrative(scene.summary));
      else{
        const significant=scene.events.filter(event=>['scene','say','hit','downed','died','act','given','found'].includes(event.kind)).slice(0,5);
        const lines=significant.length?significant:scene.events.slice(0,3);
        const overview=node('div',null,'scene-narrative');
        for(const event of lines){
          const line=scene.lines.find(line=>line.seq===event.seq);
          if(line){const excerpt=narrative(line.text+' [#'+event.seq+']');excerpt.classList.add('story-entry');excerpt.dataset.kind=storyRows([event],[])[0].category;overview.append(excerpt);}
        }
        card.append(overview);
        const selected=getProfile();
        card.append(button('Narrate this scene',async()=>{
          await api('story/recap',{scene:scene.id},selected);
          $('recap-status').textContent='Preparing the scene narrative…';
        }));
      }
      const movements=scene.events.filter(event=>['arrived','moved','left','drank','embodied','released'].includes(event.kind));
      if(movements.length)card.append(node('p',movements.slice(0,5).map(event=>scene.lines.find(line=>line.seq===event.seq)?.text).join(' · ')+(movements.length>5?' · +'+(movements.length-5)+' more':''),'scene-activity'));
      const records=node('details');
      records.dataset.scene=scene.id;records.open=expanded.has(scene.id);
      records.append(node('summary','View '+scene.events.length+' recorded events'));
      for(const event of scene.events){
        const line=scene.lines.find(line=>line.seq===event.seq);
        const row=node('div',null,'scene-record story-entry');row.dataset.kind=storyRows([event],[])[0].category;
        row.append(node('small',time(event.t)+' · #'+event.seq+' · '+event.kind),node('p',line?.text||event.kind));
        row.append(button('Details',()=>openDetails(line?.text||event.kind,event)));
        records.append(row);
      }
      card.append(records);
      const exchanges=(getData()?.messages||[]).filter(message=>message.timelineSeq>=scene.start&&message.timelineSeq<=scene.end);
      if(exchanges.length){
        const conversation=node('details');
        conversation.append(node('summary',exchanges.length+' player messages, thoughts & results'));
        for(const message of exchanges)conversation.append(node('p',(message.role==='error'?'System: ':message.role==='user'?'You: ':message.mode==='game'?'Outcome: ':'Inner thoughts: ')+message.text));
        card.append(conversation);
      }
      root.append(card);
    }
    if(!scenes.length)root.append(node('p',query?'No scenes match this search.':'Your scenes will appear when game events arrive.','empty'));
    $('story-older').hidden=!pageInfo?.more;
  }
  async function loadScenes(older=false){
    const selected=getProfile(),version=++requestVersion;
    const before=older&&scenes.length?'&before='+scenes[0].start:'';
    try{
      const result=await api('story?q='+encodeURIComponent(query)+before,undefined,selected);
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
    if(activeProfile!==getProfile()){
      activeProfile=getProfile();signature='';recapSignature='';scenes=[];pageInfo=null;
      query='';$('story-search').value='';
    }
    const next=JSON.stringify([activeProfile,data.events?.[0]?.seq,data.events?.at(-1)?.seq,data.lastReadSeq,data.historyCoverage,data.recapJob?.status,data.messages?.length]);
    if(signature!==next){signature=next;loadScenes();}
    const job=data.recapJob;
    $('catch-up').disabled=data.agentStatus==='working';
    $('recap-status').textContent=job?.status==='working'?job.progress||'Reading history…':job?.status==='error'?job.error:'';
    const recaps=data.recaps||[];
    const nextRecaps=JSON.stringify([activeProfile,recaps]);
    if(nextRecaps!==recapSignature){
      recapSignature=nextRecaps;
      $('saved-recaps').replaceChildren();
      for(const recap of [...recaps].reverse()){
        const card=node('details',null,'recap-card');
        card.open=recap.id===job?.id;
        card.append(node('summary',(recap.scene?'Scene narrative':'Catch-up')+' · '+recap.count+' events · '+new Date(recap.created).toLocaleString()));
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
