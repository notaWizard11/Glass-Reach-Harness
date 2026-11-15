import {mapConnections,mapBounds,visibleCharacters,arrangeLabels} from './atlas-geometry.mjs';
const views=new Map();
let jumpHandler=null;
export function jumpAtlas(id){jumpHandler?.(id);}
const ns='http://www.w3.org/2000/svg';
function shape(tag,attrs,text){if(attrs.stroke)attrs={'vector-effect':'non-scaling-stroke',...attrs};const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;}
export function liveAtlas(data,state,dialog,onJump){
 jumpHandler=null;
 const atlas=data.atlasWorlds?.[state.world],host=document.getElementById('atlas-canvas'),description=document.getElementById('atlas-description');
 document.getElementById('atlas-title').textContent='Explored map';host.replaceChildren();description.replaceChildren();
 if(!atlas){description.textContent='Refresh to collect location geometry.';return;}
 const places=Object.values(atlas.places),known=places.filter(p=>p.geometry),points=known.map(p=>p.geometry.at);
 for(const r of Object.values(atlas.routes))for(const p of r.route||[])if(p.length>=2&&p.every(Number.isFinite))points.push(p);
 if(!points.length){description.textContent='No measured positions observed yet. ';}
 const svg=shape('svg',{viewBox:'0 0 800 600',role:'img','aria-label':'Explored locations; north is up',style:'width:100%;touch-action:none;min-height:400px;background:#182529'});host.append(svg);
 const connections=mapConnections(atlas),{xmin,xmax,ymin,ymax}=mapBounds(atlas,connections),scale=Math.min(640/Math.max(40,xmax-xmin),440/Math.max(40,ymax-ymin));
 const xy=p=>[400+(p[0]-(xmin+xmax)/2)*scale,300-(p[1]-(ymin+ymax)/2)*scale];
 const viewKey=JSON.stringify([data.profile?.id,state.world]),view=views.get(viewKey)||{zoom:1,centre:null,selected:null};views.set(viewKey,view);
 const toolbar=document.createElement('div');toolbar.className='atlas-map-controls';host.append(toolbar);
 const focusLabel=document.createElement('span');focusLabel.setAttribute('role','status');toolbar.append(focusLabel);
 const selfButton=document.createElement('button');selfButton.textContent='Centre on Self';selfButton.type='button';selfButton.disabled=!atlas.player;toolbar.append(selfButton);
 const zoomSelfButton=document.createElement('button');zoomSelfButton.textContent='Zoom to Self';zoomSelfButton.type='button';zoomSelfButton.disabled=!atlas.player;toolbar.append(zoomSelfButton);
 const detailsButton=document.createElement('button');detailsButton.textContent='POI details';detailsButton.type='button';detailsButton.hidden=true;toolbar.append(detailsButton);
 const markers=[],screenSized=[],labels=[];
 let hoveredKey=null;
 const labelKinds={locations:['Locations','#c3d5cc'],landmarks:['Landmarks','#b5cbd0'],characters:['Characters','#7bd9ec'],routes:['Route destinations','#e4c58a'],sizes:['Dimensions','#a8bfb2'],self:['You','#ff926e']};
 const preferenceKey='glass-reach-labels-'+viewKey;
 if(!view.labelTypes){try{view.labelTypes=JSON.parse(localStorage.getItem(preferenceKey))||{};}catch{view.labelTypes={};}}
 const legendPanel=document.createElement('details');legendPanel.className='atlas-label-legend';legendPanel.open=!!view.legendOpen;
 const legendTitle=document.createElement('summary');legendTitle.textContent='Legend & labels';legendPanel.append(legendTitle);
 const legendBody=document.createElement('div');legendBody.className='atlas-legend-body';legendPanel.append(legendBody);
 for(const [kind,[name,color]]of Object.entries(labelKinds)){const row=document.createElement('label'),check=document.createElement('input'),swatch=document.createElement('span'),caption=document.createElement('span');check.type='checkbox';check.checked=view.labelTypes[kind]!==false;check.setAttribute('aria-label',name+' labels');swatch.className='atlas-legend-swatch';swatch.setAttribute('style','background:'+color);caption.textContent=name;row.append(check,swatch,caption);legendBody.append(row);check.onchange=()=>{view.labelTypes[kind]=check.checked;try{localStorage.setItem(preferenceKey,JSON.stringify(view.labelTypes));}catch{}layoutLabels();};}
 const keyText=document.createElement('p');keyText.textContent='Solid lines: authored routes. Dashed lines: connections with unknown course. Shaded boxes: place extents. Dotted circles: landmark areas. Toggles hide labels, not map features. Crowded labels yield to your selection; hover a point to reveal its name.';legendBody.append(keyText);
 legendPanel.ontoggle=()=>{view.legendOpen=legendPanel.open;layoutLabels();};host.append(legendPanel);
 function labelStyle(text){text.setAttribute('paint-order','stroke');text.setAttribute('stroke','#182529');text.setAttribute('stroke-width','3');text.setAttribute('stroke-linejoin','round');text.setAttribute('vector-effect','non-scaling-stroke');}

 const layer=shape('g',{});svg.append(layer);
 const footprints=shape('g',{}),routes=shape('g',{}),features=shape('g',{});layer.append(footprints,routes,features);
 function marker(p,label,color,r=6,action,info=null,category='locations'){
 const [x,y]=xy(p),g=shape('g',{tabindex:0,role:'button','aria-label':'Select '+label,'aria-pressed':'false',style:'cursor:pointer'});
 const ring=shape('circle',{cx:x,cy:y,r:r+6,fill:'none',stroke:'#fff1b5','stroke-width':2,visibility:'hidden','vector-effect':'non-scaling-stroke'});
 const text=shape('text',{x:x+10,y:y-10,fill:color,'font-size':13},label);labelStyle(text);g.append(shape('circle',{cx:x,cy:y,r:Math.max(12,r+6),fill:'transparent'}),ring,shape('circle',{cx:x,cy:y,r,fill:color}),text,shape('title',{},label));
 screenSized.push({element:g,x,y});
 const entry={p,label,g,ring,action,key:info?.id?'character:'+info.id:label,info};markers.push(entry);labels.push({id:entry.key,text,x,y,category:info?'characters':category,priority:label==='You'?80:info?60:category==='locations'?50:category==='landmarks'?30:20});g.onpointerenter=g.onfocus=()=>{hoveredKey=entry.key;layoutLabels();};g.onpointerleave=g.onblur=()=>{hoveredKey=null;layoutLabels();};
 g.onclick=()=>select(entry);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(entry);}};features.append(g);
 }
 for(const p of known){const at=p.geometry.at,size=p.geometry.size;if(size?.length>=2){const [x,y]=xy(at);footprints.append(shape('rect',{x:x-size[0]*scale/2,y:y-size[1]*scale/2,width:size[0]*scale,height:size[1]*scale,fill:'#31433d',stroke:'#779184'}));const labelX=x-size[0]*scale/2,labelY=y-size[1]*scale/2;const sizeLabel=shape('text',{x:labelX,y:labelY-10,fill:'#a8bfb2','font-size':12},size.join(' × ')+' '+(atlas.frame?.units||'units')+' extent');footprints.append(sizeLabel);screenSized.push({element:sizeLabel,x:labelX,y:labelY});labelStyle(sizeLabel);labels.push({id:'size:'+p.id,text:sizeLabel,x:labelX,y:labelY,category:'sizes',priority:5});}
 marker(at,p.name,p.id===atlas.current?'#ffd58a':'#c3d5cc',7,()=>{const root=dialog(p.name),text=document.createElement('p');text.textContent=(p.description||'No description recorded.')+' Last observed: '+(p.observedAt||'unknown');root.append(text);});
 if(p.id===atlas.current)for(const [name,l]of Object.entries(p.geometry.landmarks||{}))if(l.at){if(Number.isFinite(l.radius)&&l.radius>0){const [x,y]=xy(l.at);const area=shape('circle',{cx:x,cy:y,r:l.radius*scale,fill:'#94b6c0','fill-opacity':.1,stroke:'#94b6c0','stroke-opacity':.55,'stroke-dasharray':'3 4'});area.append(shape('title',{},name+' · reported radius '+l.radius+' '+(atlas.frame?.units||'units')));footprints.append(area);}marker(l.at,name+(l.radius?' · r '+l.radius+' '+(atlas.frame?.units||'') : ''),'#b5cbd0',3,undefined,null,'landmarks');}
 }
 for(const r of connections){
 const line=shape('polyline',{points:r.path.map(p=>xy(p).join(',')).join(' '),fill:'none',stroke:r.authored?'#e4c58a':'#a6b4b9','stroke-width':r.authored?3:2,'stroke-dasharray':r.authored?'none':'8 6','stroke-linecap':'round'});
 line.append(shape('title',{},r.label+' · '+(r.authored?'authored route':'connection only; course unknown')));routes.append(line);
 if(!atlas.places[r.to]?.geometry){const end=r.path.at(-1);marker(end,'To '+r.label+' (route end)','#e4c58a',4,undefined,null,'routes');}
 }
 const visible=visibleCharacters(state,{includeUnpositioned:true}),characters=visible.filter(p=>p.at),unpositioned=visible.filter(p=>!p.at);
 if(unpositioned.length){const panel=document.createElement('div');panel.className='atlas-visible-here';const title=document.createElement('strong');title.textContent='Visible here';panel.append(title);for(const person of unpositioned){const button=document.createElement('button');button.type='button';button.textContent=person.name+' · position not reported';button.onclick=()=>{const root=dialog(person.name),text=document.createElement('p');text.textContent=[person.description,person.spot,'Visible with you at '+(state.here?.name||atlas.places[atlas.current]?.name||'your current location')+'. The server has not reported precise coordinates.'].filter(Boolean).join(' ');root.append(text);};panel.append(button);}host.append(panel);}

 for(const person of characters){const detail=()=>{const root=dialog(person.name),text=document.createElement('p');text.textContent=[person.description,person.spot,Number.isFinite(person.distance)?person.distance+' '+(atlas.frame?.units||'units')+' away '+(person.bearing||''):'','Visible in the latest observation.'].filter(Boolean).join(' · ');root.append(text);};marker(person.at,person.name+' · visible','#7bd9ec',5,detail,person);}
 if(view.selected?.startsWith('character:')&&!markers.some(m=>m.key===view.selected))view.selected=null;
 if(atlas.player)marker(atlas.player,'You','#ff926e',5,undefined,null,'self');
 svg.append(shape('text',{x:20,y:30,fill:'#d9e6df','font-size':14},'N ↑ · '+(atlas.frame?.units||'units')));
 const maxZoom=Math.max(100,80/scale),minZoom=.2;
 let zoom=Math.max(minZoom,Math.min(maxZoom,view.worldScale?view.worldScale/scale:view.zoom)),pan=[0,0],drag=null;
 const sliderPosition=z=>1000*Math.log(z/minZoom)/Math.log(maxZoom/minZoom);
 const sliderZoom=v=>minZoom*Math.pow(maxZoom/minZoom,v/1000);
 const slider=document.getElementById('map-zoom');slider.min=0;slider.max=1000;slider.step=1;slider.value=sliderPosition(zoom);
 function transform(){for(const {element,x,y} of screenSized)element.setAttribute('transform',`translate(${x} ${y}) scale(${1/zoom}) translate(${-x} ${-y})`);layer.setAttribute('transform',`translate(${pan}) translate(400 300) scale(${zoom}) translate(-400 -300)`);view.zoom=zoom;view.worldScale=zoom*scale;view.centre=[(xmin+xmax)/2-pan[0]/(zoom*scale),(ymin+ymax)/2+pan[1]/(zoom*scale)];layoutLabels();}
 function layoutLabels(){
 const screen=(x,y)=>[400+pan[0]+zoom*(x-400),300+pan[1]+zoom*(y-300)];
 const obstacles=markers.map(m=>{const [x,y]=screen(...xy(m.p));return {x:x-6,y:y-6,width:12,height:12};});
 // Keep labels clear of the map's HTML controls as well as other names.
 if(svg.getScreenCTM&&typeof DOMPoint!=='undefined'){const matrix=svg.getScreenCTM();if(matrix)for(const element of [toolbar,legendPanel]){const box=element.getBoundingClientRect(),inv=matrix.inverse(),a=new DOMPoint(box.left,box.top).matrixTransform(inv),b=new DOMPoint(box.right,box.bottom).matrixTransform(inv);obstacles.push({x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y});}}
 const inputs=labels.map(l=>{const [x,y]=screen(l.x,l.y);let width=0;try{width=l.text.getComputedTextLength();}catch{}return {...l,x,y,width:width||String(l.text.textContent||'').length*7.5,enabled:view.labelTypes[l.category]!==false,priority:l.id===view.selected?200:l.id===hoveredKey?150:l.priority};});
 const placements=arrangeLabels(inputs,{obstacles});
 for(const l of labels){const placement=placements.get(l.id);l.text.setAttribute('visibility',placement?'visible':'hidden');if(placement){l.text.setAttribute('x',l.x+placement.dx);l.text.setAttribute('y',l.y+placement.dy);}}
 }
 function centre(p){const [x,y]=xy(p);pan=[zoom*(400-x),zoom*(300-y)];transform();}
 function highlight(){for(const m of markers){const active=m.key===view.selected;m.g.setAttribute('aria-pressed',String(active));m.ring.setAttribute('visibility',active?'visible':'hidden');}const selected=markers.find(m=>m.key===view.selected);focusLabel.textContent=selected?'Zoom focus: '+selected.label:'Select a POI to focus zoom';detailsButton.hidden=!selected?.action;detailsButton.textContent=selected?.info?'Character details':'POI details';detailsButton.onclick=()=>selected?.action?.();const card=document.getElementById('atlas-place-description');if(card){card.replaceChildren();const place=selected?.info||places.find(p=>p.name===selected?.label)||atlas.places[atlas.current];const title=document.createElement('h3'),text=document.createElement('p');title.textContent=place?.name||'Field notes';text.textContent=place?.description||'No description recorded for this location yet.';card.append(title,text);}}
 function select(m){view.selected=m.key;highlight();centre(m.p);}
 function setZoom(value){const target=markers.find(m=>m.key===view.selected)?.p||view.centre;zoom=Math.max(minZoom,Math.min(maxZoom,value));slider.value=sliderPosition(zoom);if(target)centre(target);else transform();}
 selfButton.onclick=()=>{const self=markers.find(m=>m.label==='You');if(self)select(self);};
 function zoomTo(m,geometry){select(m);const size=geometry?.size;const target=size?.length>=2?Math.min(540/Math.max(10,size[0]),340/Math.max(10,size[1]))/scale:12/scale;setZoom(target);}
 zoomSelfButton.onclick=()=>{const self=markers.find(m=>m.label==='You');if(self){select(self);setZoom(Math.max(zoom,16/scale));}};
 jumpHandler=id=>{const place=atlas.places[id];if(!place)return;const marker=place.geometry?markers.find(m=>m.label===place.name):markers.find(m=>m.label==='To '+place.name+' (route end)');if(marker)zoomTo(marker,place.geometry);};
 const search=document.getElementById('atlas-search'),list=document.getElementById('atlas-location-list'),searchStatus=document.getElementById('atlas-search-status');
 if(search&&list){
 const drawLocations=()=>{list.replaceChildren();const query=(search.value||'').trim().toLowerCase(),matches=places.filter(p=>(p.name+' '+(p.description||'')).toLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
 if(searchStatus)searchStatus.textContent=matches.length+' of '+places.length+' known locations';
 for(const p of matches){const card=document.createElement('article');card.className='atlas-location-card';const title=document.createElement('strong');title.textContent=p.name;const note=document.createElement('small');const route=connections.some(r=>r.to===p.id&&r.authored);note.textContent=p.geometry?(p.id===atlas.current?'Current location · ':'')+'Position recorded':route?'Route endpoint recorded; location extent unknown':'Position not yet observed';const jump=document.createElement('button');jump.textContent=p.geometry?'Jump & zoom':route?'Jump to route end':'No position yet';jump.disabled=!p.geometry&&!route;jump.setAttribute('aria-label',jump.textContent+' · '+p.name);jump.onclick=()=>onJump?onJump(p.id):jumpHandler(p.id);card.append(title,note,jump);list.append(card);}
 if(!matches.length){const empty=document.createElement('p');empty.textContent='No matching locations.';list.append(empty);}
 };
 search.oninput=drawLocations;search.onkeydown=e=>{if(e.key==='Enter'){const match=places.filter(p=>p.name.toLowerCase().includes((search.value||'').toLowerCase())).find(p=>p.geometry||connections.some(r=>r.to===p.id&&r.authored));if(match){e.preventDefault();if(onJump)onJump(match.id);else jumpHandler(match.id);}}};drawLocations();
 }
 // Convert client movement through the SVG viewport, including letterboxing.
 const local=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
 svg.onpointerdown=e=>{if(e.button!==0||e.target.closest('[role="button"]'))return;const p=local(e);drag=[p.x,p.y,...pan];svg.setPointerCapture(e.pointerId);};
 svg.onpointermove=e=>{if(drag){const p=local(e);pan=[drag[2]+p.x-drag[0],drag[3]+p.y-drag[1]];transform();}};
 svg.onpointerup=svg.onpointercancel=()=>drag=null;
 slider.oninput=()=>setZoom(sliderZoom(Number(slider.value)));
 svg.onwheel=e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));};
 if(view.centre)centre(view.centre);else transform();highlight();
 const legend=document.createElement('p');legend.textContent='Shaded boxes: reported place extents · Dotted circles: reported landmark radii (not wall outlines) · Solid gold: authored routes · Dashed: connections with unknown course. A route endpoint is not the destination centre. Cyan markers: characters visible in the latest live observation.';description.append(legend);
 const status=document.createElement('p');status.textContent=`${known.length} positioned locations · Last observation: ${atlas.updated}. Routes and positions are remembered observations. Select a POI to centre zoom on it. Drag to pan; scroll or use the slider to zoom.`;description.append(status);
 const unresolved=Object.values(atlas.routes).filter(r=>!connections.some(c=>c.from===r.from&&c.to===r.to));if(unresolved.length){const heading=document.createElement('h3');heading.textContent='Connections without plotted geometry';description.append(heading);for(const r of unresolved){const row=document.createElement('p');row.textContent=(atlas.places[r.from]?.name||r.from)+' → '+(atlas.places[r.to]?.name||r.to)+(r.metrics?' · '+(r.metrics.bearing||'')+' '+(r.metrics.straight??'?')+' '+(atlas.frame?.units||''):'');description.append(row);}}
 const missing=places.filter(p=>!p.geometry);if(missing.length){const title=document.createElement('h3');title.textContent='Known places — position not yet observed';description.append(title);for(const p of missing){const row=document.createElement('p');const exits=Object.values(atlas.routes).filter(r=>r.to===p.id);row.textContent=p.name+exits.map(r=>r.metrics?` · ${r.metrics.bearing||''} ${r.metrics.straight??'?'} ${atlas.frame?.units||''} from ${atlas.places[r.from]?.name}`:'').join('');description.append(row);}}
}
