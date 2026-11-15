export function mountAutopilot({api,getData,getProfile,reload,openDialog,field,button,paragraph,details,onError,openSettings}){
 const panel=document.createElement('section');panel.className='autopilot-panel';
 panel.innerHTML=`<h3>Autopilot</h3><p id="pilot-status" role="status">Off</p><p id="pilot-model" class="caption"></p><button id="pilot-model-settings" class="quiet">Choose autopilot model in Settings ↗</button>
 <label>Motivations & goals<textarea id="pilot-prompt" rows="5" maxlength="8000" placeholder="What drives this character? What should they try to achieve, and how should they treat others?"></textarea></label>
 <fieldset class="pilot-permissions"><legend>Allowed actions</legend>
 <label><input type="checkbox" data-pilot-permission="talk"> Talk and reply</label>
 <label><input type="checkbox" data-pilot-permission="travel"> Travel</label>
 <label><input type="checkbox" data-pilot-permission="interact"> Interact with things</label>
 <label><input type="checkbox" data-pilot-permission="attack"> Initiate attacks</label>
 <label><input type="checkbox" data-pilot-permission="selfDefence"> Self-defence</label></fieldset>
 <p class="caption">Interactions include taking, giving, using and unlocking items. Self-defence allows brace/yield and retaliation against a recent recorded attacker. Following, finishing blows, destructive verbs and unsupported actions are excluded.</p>
 <div class="pilot-limits"><label>Decision interval<select id="pilot-interval"><option value="30">30 seconds</option><option value="60" selected>1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option></select></label>
 <label>Run for (minutes)<input id="pilot-minutes" type="number" min="5" max="480" value="60"></label>
 <label>Maximum actions<input id="pilot-actions" type="number" min="1" max="200" value="20"></label>
 <label>Maximum model decisions<input id="pilot-decisions" type="number" min="1" max="500" value="60"></label></div>
 <details><summary>Limit permitted locations</summary><p class="caption">Leave all unchecked for any known reachable route. Include the current location when restricting travel.</p><div id="pilot-locations"></div></details>
 <div class="inline"><button id="pilot-save">Save configuration</button><button id="pilot-start" class="primary">Review & start</button><button id="pilot-pause" class="danger">Pause autopilot</button></div>
 <p class="caption">Runs while the tab is in the background, with the server running and PC awake. Each decision uses Codex. Sending a message or manual game action pauses autopilot. Server restarts require you to start it again. Pause cannot undo an action already sent.</p>
 <details><summary>Autopilot activity</summary><div id="pilot-log"></div></details>`;
 document.getElementById('watch-controls').prepend(panel);
 const $=id=>panel.querySelector('#'+id);let dirty=false,activeProfile,logSignature='',placesSignature='';
 panel.addEventListener('input',()=>{dirty=true;});panel.addEventListener('change',()=>{dirty=true;});
 function config(){return {prompt:$('pilot-prompt').value,permissions:Object.fromEntries([...panel.querySelectorAll('[data-pilot-permission]')].map(x=>[x.dataset.pilotPermission,x.checked])),interval:Number($('pilot-interval').value),minutes:Number($('pilot-minutes').value),maxActions:Number($('pilot-actions').value),maxDecisions:Number($('pilot-decisions').value),locations:[...panel.querySelectorAll('[data-pilot-location]:checked')].map(x=>x.value)};}
 async function submit(start,selected=getProfile(),settings=config()){await api('autopilot',{config:settings,start},selected);dirty=false;await reload(selected);}
 $('pilot-save').onclick=()=>submit(false).catch(onError);
 $('pilot-pause').onclick=()=>api('autopilot',{pause:true}).then(()=>reload()).catch(onError);
 $('pilot-model-settings').onclick=openSettings;
 $('pilot-start').onclick=()=>{
   const selected=getProfile(),settings=config(),data=getData(),root=openDialog('Start autopilot · '+data.profile.name);
   paragraph(root,settings.prompt||'Enter motivations and goals before starting.');
   const names={talk:'Talking',travel:'Travelling',interact:'Interacting with things',attack:'Initiating attacks',selfDefence:'Self-defence'};
   paragraph(root,'Allowed: '+Object.entries(settings.permissions).filter(([,yes])=>yes).map(([key])=>names[key]).join(', '));
   paragraph(root,settings.minutes+' minutes · at most '+settings.maxActions+' actions and '+settings.maxDecisions+' model decisions · '+settings.interval+' seconds between decisions.');
   paragraph(root,'Model: '+(data.modelsByPurpose?.autopilot||data.model||'Account default'));
   paragraph(root,'Locations: '+(settings.locations.length?settings.locations.map(id=>data.names?.[id]||id).join(', '):'Known reachable routes'));
   paragraph(root,'Starting authorizes the dashboard to send permitted game actions without asking each time.');
   root.append(button('Start with these permissions',async()=>{try{await submit(true,selected,settings);document.getElementById('drawer').close();}catch(error){onError(error);}},'primary'));
 };
 function update(){
   const data=getData();if(!data)return;const auto=data.autopilot,settings=auto?.config||{};
   if(activeProfile!==getProfile()){activeProfile=getProfile();dirty=false;placesSignature='';logSignature='';}
   $('pilot-status').textContent=(auto?.enabled?'On · '+auto.status:'Paused / off')+' — '+(auto?.reason||'Not started.')+(auto?.started?' · '+(auto.actions||0)+' actions / '+(auto.decisions||0)+' decisions':'');
   $('pilot-model').textContent='Model: '+(data.modelsByPurpose?.autopilot||data.model||'Account default');
   $('pilot-pause').disabled=!auto?.enabled;$('pilot-start').disabled=Boolean(auto?.enabled)||data.agentStatus==='working';
   const places=data.state?.places||[],nextPlaces=JSON.stringify(places.map(p=>[p.id,p.name]));
   if(nextPlaces!==placesSignature){
     const checked=dirty?config().locations:settings.locations||[];placesSignature=nextPlaces;$('pilot-locations').replaceChildren();
     for(const place of places){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.pilotLocation=place.id;input.value=place.id;input.checked=checked.includes(place.id);label.append(input,document.createTextNode(place.name));$('pilot-locations').append(label);}
   }
   if(!dirty){$('pilot-prompt').value=settings.prompt||'';$('pilot-interval').value=settings.interval||60;$('pilot-minutes').value=settings.minutes||60;$('pilot-actions').value=settings.maxActions||20;$('pilot-decisions').value=settings.maxDecisions||60;
     for(const input of panel.querySelectorAll('[data-pilot-permission]'))input.checked=Boolean(settings.permissions?.[input.dataset.pilotPermission]);
     for(const input of panel.querySelectorAll('[data-pilot-location]'))input.checked=(settings.locations||[]).includes(input.value);
   }
   const nextLog=JSON.stringify(auto?.log||[]);if(nextLog!==logSignature){logSignature=nextLog;$('pilot-log').replaceChildren();for(const entry of [...(auto?.log||[])].reverse().slice(0,30)){const row=document.createElement('div');row.className='note';paragraph(row,new Date(entry.time).toLocaleTimeString()+' · '+entry.status+' · '+entry.text);if(entry.op)row.append(details({op:entry.op,args:entry.args,result:entry.result},'Decision & result'));$('pilot-log').append(row);}}
 }
 return {update};
}
