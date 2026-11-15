import {groups,normalizeTrigger} from './triggers.mjs';
export function triggerSummary(t){const label=Object.values(groups).flat().find(([k])=>k===t.kind)?.[1]||t.kind;return [label,t.person,t.phrase,t.threshold!=null?(['water','hp'].includes(t.kind)?'≤ ':t.kind==='delay'?'Minutes: ':'Game seconds: ')+t.threshold:'',t.value,t.verb,t.item,'Scope: '+(t.scope||'current')+(t.place?' ('+t.place+')':''),t.mode==='transition'?'when it becomes true':'when true'].filter(Boolean).join(' · ');}
export function triggerEditor(root,{state,draft={},field,button}){
 let kind=draft.kind==='dusk'?'time':draft.kind||'arrival';
 const picker=document.createElement('div');picker.className='trigger-picker';root.append(picker);
 const category=document.createElement('div'),choices=document.createElement('div');category.className=choices.className='trigger-tags';picker.append(category,choices);
 let group=Object.keys(groups).find(g=>groups[g].some(([k])=>k===kind));
 const controls=document.createElement('div');root.append(controls);
 const people=[...new Map([state.you,...(state.present||[]),...(state.knows||[]).map(p=>({id:p.who||p.id,name:p.name}))].filter(p=>p?.id).map(p=>[p.id,p.name||p.id])).entries()];
 const places=[...new Map([state.here,...(state.places||[]),...(state.known_places||[])].filter(p=>p?.id).map(p=>[p.id,p.name||p.id])).entries()];
 const person=field(controls,'Character (blank means any speaker / attacker)','text',draft.person,[['','Any'],...people]);
 const phrase=field(controls,'Words to match (optional)','text',draft.phrase||'');
 const threshold=field(controls,'Threshold / deadline','number',draft.threshold??3);threshold.min=0;
 const value=field(controls,'Time of day or weather text','text',draft.kind==='dusk'?'dusk':draft.value||'');
 const item=field(controls,'Item ID (blank means any item)','text',draft.item||'');
 const verb=field(controls,'Action verb','text',draft.verb||'');
 const target=field(controls,'Action target ID (optional)','text',draft.target||'');
 const scope=field(controls,'Location scope','text',draft.scope||'current',[['current','Where I arm this'],['place','Selected location'],['any','Anywhere in this world']]);
 const place=field(controls,'Selected location / destination','text',draft.place||state.here?.id,[['','Choose a location…'],...places]);
 const mode=field(controls,'Condition behaviour','text',draft.mode||'true',[['true','Fire if already true'],['transition','Wait until it becomes true']]);
 const help=document.createElement('p');help.className='caption';controls.append(help);
 function show(){
 const visible={person:['arrival','departure','present','absent','reply','speech','attack','hit','missed','wounded','downed'].includes(kind),phrase:['reply','speech'].includes(kind),threshold:['water','hp','delay','gameTime'].includes(kind),value:['time','weather'].includes(kind),item:['received','lost'].includes(kind),verb:kind==='available',target:kind==='available',place:scope.value==='place'||kind==='destination'};
 for(const [key,input]of Object.entries({person,phrase,threshold,value,item,verb,target,place}))input.parentElement.hidden=!visible[key];
 help.textContent=kind==='delay'?'Delay is in real-world minutes from arming; it must fit within the expiry.':kind==='gameTime'?'Deadline is absolute game time in seconds. Current game time: '+state.t:kind==='destination'?'Choose Anywhere or the destination as scope to allow travel.':'New-event triggers only match events observed after arming. State conditions are checked on each successful refresh.';
 }
 function render(){category.replaceChildren();for(const g of Object.keys(groups)){const b=button(g,()=>{group=g;kind=groups[g][0][0];render();});b.setAttribute('aria-pressed',String(g===group));category.append(b);}choices.replaceChildren();for(const [k,label]of groups[group]){const b=button(label,()=>{kind=k;render();});b.setAttribute('aria-pressed',String(k===kind));choices.append(b);}show();}
 scope.onchange=show;render();
 return ()=>normalizeTrigger({kind,scope:scope.value,mode:mode.value,...Object.fromEntries(Object.entries({person,phrase,threshold,value,item,verb,target,place}).filter(([,input])=>!input.parentElement.hidden).map(([key,input])=>[key,input.value]))});
}
