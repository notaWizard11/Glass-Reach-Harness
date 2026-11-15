export const RESPONSE_LIFETIME=15000;
export class ResponseInbox {
 constructor(now=()=>Date.now()){this.now=now;this.enabled=true;this.page='play';this.profile=null;this.pending=new Map();this.cards=[];}
 context(profile,page,enabled=this.enabled){
  if(profile!==this.profile){this.pending.clear();this.cards=[];}
  this.profile=profile;this.page=page;this.enabled=enabled;
  if(page==='play'||!enabled)this.cards=[];
 }
 track(requestId,mode){if(this.enabled&&this.page!=='play')this.pending.set(requestId,{profile:this.profile,mode});}
 cancel(requestId){this.pending.delete(requestId);}
 receive(profile,messages){
  const added=[];
  for(const message of messages||[]){
   const request=this.pending.get(message.requestId);
   if(!request||request.profile!==profile||!['assistant','error'].includes(message.role))continue;
   this.pending.delete(message.requestId);
   if(!this.enabled||this.page==='play'||profile!==this.profile||!message.text?.trim())continue;
   const card={id:message.id||message.requestId,text:message.text,mode:request.mode,error:message.role==='error',expires:this.now()+RESPONSE_LIFETIME};
   this.cards.push(card);added.push(card);
  }
  return added;
 }
 dismiss(id){this.cards=this.cards.filter(card=>card.id!==id);}
 expired(){const ids=this.cards.filter(card=>card.expires<=this.now()).map(card=>card.id);for(const id of ids)this.dismiss(id);return ids;}
}

export function responseMessages(snapshot){
 const rows=[...(snapshot.messages||[])],job=snapshot.recapJob;
 if(job?.requestId&&['complete','error'].includes(job.status))rows.push({id:job.id,requestId:job.requestId,role:job.status==='error'?'error':'assistant',text:job.text||job.error});
 return rows;
}

export function mountResponseNotifications({composer,toggle,host,getPage,getProfile,onPlay}){
 const inbox=new ResponseInbox(),elements=new Map(),timers=new Map(),closing=new Set();
 let enabled=true;try{enabled=localStorage.getItem('gr-response-notifications')!=='off';}catch{}
 toggle.checked=enabled;
 const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const snapshots=()=>new Map([...elements].map(([id,element])=>[id,element.getBoundingClientRect().top]));
 function slide(before){if(reduced())return;for(const [id,element]of elements){const old=before.get(id);if(old!=null){const delta=old-element.getBoundingClientRect().top;if(delta)element.animate?.([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:240,easing:'ease-out'});}}}
 function clear(){for(const timer of timers.values())clearTimeout(timer);timers.clear();closing.clear();elements.clear();host.replaceChildren();}
 function context(){const changed=inbox.profile!==getProfile();inbox.context(getProfile(),getPage(),enabled);const active=enabled&&getPage()!=='play';host.hidden=!active;composer.classList.toggle('has-response-notifications',active);if(changed||!active)clear();}
 function remove(id,immediate=false){
  const card=elements.get(id);if(!card||closing.has(id))return;closing.add(id);inbox.dismiss(id);clearTimeout(timers.get(id));
  const finish=()=>{if(elements.get(id)!==card)return;const before=snapshots();card.remove();elements.delete(id);timers.delete(id);closing.delete(id);slide(before);};
  if(immediate||reduced()){finish();return;}
  card.animate?.([{opacity:1},{opacity:0}],{duration:450,easing:'ease-in',fill:'forwards'});
  timers.set(id,setTimeout(finish,450));
 }
 function add(item){
  const before=snapshots(),card=document.createElement('article');card.className='response-card';
  const head=document.createElement('div');head.className='response-card-heading';
  const title=document.createElement('strong');title.textContent=item.error?'Response interrupted':item.mode==='game'?'Action response':'Inner thoughts';
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='response-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss '+title.textContent.toLowerCase()+' notification');dismiss.onclick=()=>remove(item.id);
  const body=document.createElement('div');body.className='response-card-body';body.textContent=item.text;body.tabIndex=0;
  const link=document.createElement('button');link.type='button';link.className='quiet';link.textContent='Read in Play';link.onclick=onPlay;
  head.append(title,dismiss);card.append(head,body,link);elements.set(item.id,card);host.append(card);slide(before);host.scrollTop=host.scrollHeight;
  if(!reduced())card.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
  timers.set(item.id,setTimeout(()=>remove(item.id),Math.max(0,item.expires-Date.now())));
 }
 toggle.onchange=()=>{enabled=toggle.checked;try{localStorage.setItem('gr-response-notifications',enabled?'on':'off');}catch{}context();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const id of inbox.expired())remove(id,true);});
 context();
 return {context,track(requestId,mode){context();inbox.track(requestId,mode);},cancel(requestId){inbox.cancel(requestId);},update(profile,snapshot){context();for(const id of inbox.expired())remove(id);for(const card of inbox.receive(profile,responseMessages(snapshot)))add(card);}};
}
