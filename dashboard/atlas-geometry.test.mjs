import test from 'node:test';import assert from 'node:assert/strict';import {mapConnections,mapBounds,visibleCharacters,arrangeLabels} from './atlas-geometry.mjs';
test('routes preserve authored course and never equate endpoints with place centres',()=>{const a={places:{a:{geometry:{at:[0,0]}},b:{},c:{geometry:{at:[50,50]}}},routes:{ab:{from:'a',to:'b',route:[[10,0],[20,0]]},ac:{from:'a',to:'c'},bc:{from:'b',to:'c'}}};const c=mapConnections(a);assert.equal(c.length,2);assert.equal(c[0].authored,true);assert.deepEqual(c[0].path,[[10,0],[20,0]]);assert.equal(c[1].authored,false);assert.equal(a.places.b.geometry,undefined);});
test('bounds include full footprints, landmark radii and routes without forcing origin into view',()=>{const a={places:{a:{geometry:{at:[100,100],size:[30,40,12],landmarks:{pool:{at:[130,100],radius:10}}}}},routes:{}};assert.deepEqual(mapBounds(a,[]),{xmin:85,xmax:140,ymin:80,ymax:120});});

test('character markers require live visibility and valid current coordinates',()=>{
 const state={connection:'Live',you:{id:'me'},present:[{id:'me',type:'person'},{id:'guard',type:'fighter',name:'Guard'},{id:'jar',type:'thing'},{id:'unpositioned',type:'person'},{id:'hidden',type:'person',state:{hidden:true}}],layout:{present:[{id:'me',at:[0,0]},{id:'guard',at:[2,3]},{id:'jar',at:[1,1]},{id:'departed',at:[4,4]},{id:'hidden',at:[5,5]}]}};
 assert.deepEqual(visibleCharacters(state).map(p=>p.id),['guard']);
 assert.deepEqual(visibleCharacters(state,{includeUnpositioned:true}).map(p=>p.id),['guard','unpositioned']);
 assert.equal(visibleCharacters(state,{includeUnpositioned:true})[1].at,undefined);
 state.layout.present[1].at=[20,30];assert.deepEqual(visibleCharacters(state)[0].at,[20,30]);
 state.present=state.present.filter(p=>p.id!=='guard');assert.deepEqual(visibleCharacters(state),[]);
 state.present=[{id:'guard',type:'person'}];state.connection='Saved observation';assert.deepEqual(visibleCharacters(state),[]);
 state.connection='Live';state.layout.present[1].at=[NaN,3];assert.deepEqual(visibleCharacters(state),[]);
});

test('crowded labels do not overlap; selection wins and disabled labels stay hidden',()=>{
 const labels=Array.from({length:25},(_,i)=>({id:String(i),x:400,y:300,width:100,priority:i===20?200:20,enabled:i!==21}));
 const arranged=arrangeLabels(labels);
 assert.ok(arranged.get('20'));assert.equal(arranged.get('21'),null);assert.ok([...arranged.values()].some(v=>v===null));
 const boxes=[...arranged.values()].filter(Boolean).map(v=>v.box);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
 assert.equal(arrangeLabels([{id:'offscreen',x:-100,y:200,width:60,priority:200}]).get('offscreen'),null);
 const blocked=arrangeLabels([{id:'a',x:400,y:300,width:100}],{obstacles:[{x:0,y:0,width:800,height:600}]});assert.equal(blocked.get('a'),null);
});
