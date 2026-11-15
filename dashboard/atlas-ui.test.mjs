import test from 'node:test';import assert from 'node:assert/strict';import {liveAtlas} from './atlas-ui.js';
class Element {constructor(tag){this.tag=tag;this.children=[];this.attrs={};}setAttribute(k,v){this.attrs[k]=String(v);}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;} }
const walk=e=>[e,...e.children.flatMap(walk)];
test('selecting a POI anchors wheel and slider zoom, survives refresh, and self button recentres',()=>{
 const ids=Object.fromEntries(['atlas-canvas','atlas-description','atlas-title','map-zoom','atlas-search','atlas-location-list','atlas-search-status','atlas-place-description'].map(k=>[k,new Element('div')]));
 globalThis.document={getElementById:k=>ids[k],createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t)};
 try{
 const data={profile:{id:'test-controls'},atlasWorlds:{w:{places:{a:{id:'a',name:'Hold',geometry:{at:[0,0],size:[30,40],landmarks:{Well:{at:[8,10],radius:2}}}}},routes:{},current:'a',player:[10,2],updated:'now'}}};
 const sliderAt=z=>1000*Math.log(z/.2)/Math.log(100/.2);
 const observation={world:'w',connection:'Live',you:{id:'me'},present:[],layout:{present:[]}};
 const render=()=>liveAtlas(data,observation,()=>new Element('dialog'));
 render();let all=walk(ids['atlas-canvas']);let svg=all.find(e=>e.tag==='svg');let layer=svg.children[0];
 const poi=all.find(e=>e.attrs['aria-label']?.startsWith('Select Well'));poi.onclick();assert.equal(poi.attrs['aria-pressed'],'true');
 const first=layer.attrs.transform;svg.onwheel({preventDefault(){},deltaY:-500});assert.notEqual(layer.attrs.transform,first);
 ids['map-zoom'].value=sliderAt(2);ids['map-zoom'].oninput();
 // Symbols and text cancel camera zoom; measured geometry keeps it.
 const radiusArea=all.find(e=>e.tag==='circle'&&e.attrs['fill-opacity']==='0.1');
 const measuredRadius=radiusArea.attrs.r;
 for(const value of [20,10000]){
 ids['map-zoom'].value=sliderAt(value/100);ids['map-zoom'].oninput();const zoom=value/100;
 for(const marker of all.filter(e=>e.attrs.role==='button')){
 const inverse=Number(marker.attrs.transform.match(/scale\(([^)]+)\)/)[1]);assert.ok(Math.abs(inverse*zoom-1)<1e-10);
 }
 const extent=all.find(e=>e.tag==='text'&&e.textContent?.endsWith(' extent'));
 assert.equal(Number(extent.attrs.transform.match(/scale\(([^)]+)\)/)[1])*zoom,1);
 assert.equal(radiusArea.attrs.r,measuredRadius);assert.equal(radiusArea.attrs.transform,undefined);
 for(const line of all.filter(e=>e.attrs.stroke))assert.equal(line.attrs['vector-effect'],'non-scaling-stroke');
 }
 ids['map-zoom'].value=sliderAt(2);ids['map-zoom'].oninput();
 const focused=layer.attrs.transform;assert.match(focused,/scale\(2(?:\.0+4)?\)/);
 render();all=walk(ids['atlas-canvas']);svg=all.find(e=>e.tag==='svg');layer=svg.children[0];assert.equal(layer.attrs.transform,focused);assert.equal(all.find(e=>e.attrs['aria-label']?.startsWith('Select Well')).attrs['aria-pressed'],'true');
 all.find(e=>e.textContent==='Centre on Self').onclick();assert.equal(all.find(e=>e.attrs['aria-label']==='Select You').attrs['aria-pressed'],'true');assert.notEqual(layer.attrs.transform,focused);assert.match(layer.attrs.transform,/scale\(2(?:\.0+4)?\)/);
 // Search and explicit jumps retain location selection and fit its footprint.
 ids['atlas-search'].value='Hold';ids['atlas-search'].oninput();
 assert.equal(ids['atlas-location-list'].children.length,1);
 walk(ids['atlas-location-list']).find(e=>e.textContent==='Jump & zoom').onclick();
 assert.equal(all.find(e=>e.attrs['aria-label']==='Select Hold').attrs['aria-pressed'],'true');
 assert.equal(ids['atlas-place-description'].children[0].textContent,'Hold');
 all.find(e=>e.textContent==='Zoom to Self').onclick();
 assert.equal(all.find(e=>e.attrs['aria-label']==='Select You').attrs['aria-pressed'],'true');
 const selfZoom=Number(layer.attrs.transform.match(/scale\(([^)]+)\)/)[1]);assert.ok(selfZoom*11>=16);
 ids['atlas-search'].value='missing place';ids['atlas-search'].oninput();assert.equal(ids['atlas-location-list'].children[0].textContent,'No matching locations.');
 ids['atlas-search'].value='';
 ids['map-zoom'].value=sliderAt(2);ids['map-zoom'].oninput();
 const oldCentreScale=2*11;
 data.atlasWorlds.w.places.far={id:'far',name:'Far away',geometry:{at:[10000,0]}};
 render();all=walk(ids['atlas-canvas']);svg=all.find(e=>e.tag==='svg');layer=svg.children[0];
 const cameraZoom=Number(layer.attrs.transform.match(/scale\(([^)]+)\)/)[1]);
 const baseScale=640/10015;assert.ok(Math.abs(cameraZoom*baseScale-oldCentreScale)<1e-8);
 ids['map-zoom'].value=1000;ids['map-zoom'].oninput();
 const maxCameraZoom=Number(layer.attrs.transform.match(/scale\(([^)]+)\)/)[1]);assert.ok(Math.abs(maxCameraZoom*baseScale-80)<1e-8);
 observation.present=[{id:'guard',name:'Guard',type:'fighter',state:{description:'A watchful guard.'}}];observation.layout.present=[{id:'guard',at:[1,2]}];
 render();all=walk(ids['atlas-canvas']);let guard=all.find(e=>e.attrs['aria-label']==='Select Guard · visible');assert.ok(guard);guard.onclick();assert.equal(ids['atlas-place-description'].children[0].textContent,'Guard');
 const oldPosition=guard.children[0].attrs.cx;observation.layout.present[0].at=[8,9];render();all=walk(ids['atlas-canvas']);guard=all.find(e=>e.attrs['aria-label']==='Select Guard · visible');assert.notEqual(guard.children[0].attrs.cx,oldPosition);assert.equal(guard.attrs['aria-pressed'],'true');
 observation.layout.present=[];render();assert.ok(walk(ids['atlas-canvas']).some(e=>e.textContent==='Guard · position not reported'));assert.equal(walk(ids['atlas-canvas']).some(e=>e.attrs['aria-label']==='Select Guard · visible'),false);
 observation.present=[];render();assert.equal(walk(ids['atlas-canvas']).some(e=>e.textContent==='Guard · position not reported'),false);assert.equal(walk(ids['atlas-canvas']).some(e=>e.attrs['aria-label']==='Select Guard · visible'),false);
 observation.present=[{id:'guard',name:'Guard',type:'person'}];observation.connection='Saved observation';render();assert.equal(walk(ids['atlas-canvas']).some(e=>e.attrs['aria-label']==='Select Guard · visible'),false);
 assert.equal(data.atlasWorlds.w.places.guard,undefined);
 // Label switches hide only text and persist across live redraws.
 render();all=walk(ids['atlas-canvas']);const locationSwitch=all.find(e=>e.attrs['aria-label']==='Locations labels');assert.ok(locationSwitch.checked);locationSwitch.checked=false;locationSwitch.onchange();
 let hold=all.find(e=>e.attrs['aria-label']==='Select Hold');hold.onclick();assert.equal(hold.children.find(e=>e.tag==='text').attrs.visibility,'hidden');assert.equal(hold.attrs.visibility,undefined);
 render();all=walk(ids['atlas-canvas']);assert.equal(all.find(e=>e.attrs['aria-label']==='Locations labels').checked,false);
 const locationSwitchAgain=all.find(e=>e.attrs['aria-label']==='Locations labels');locationSwitchAgain.checked=true;locationSwitchAgain.onchange();hold=all.find(e=>e.attrs['aria-label']==='Select Hold');hold.onclick();assert.equal(hold.children.find(e=>e.tag==='text').attrs.visibility,'visible');
 observation.connection='Live';observation.layout.present=[{id:'guard',at:[3,4]}];render();all=walk(ids['atlas-canvas']);assert.ok(all.some(e=>e.attrs['aria-label']==='Select Guard · visible'));assert.equal(all.some(e=>e.textContent==='Guard · position not reported'),false);

 }finally{delete globalThis.document;}
});
