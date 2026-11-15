const point=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite);
export function mapConnections(atlas){
 return Object.values(atlas.routes||{}).flatMap(r=>{
  const from=atlas.places[r.from]?.geometry?.at,to=atlas.places[r.to]?.geometry?.at;
  if(Array.isArray(r.route)&&r.route.length>=2&&r.route.every(point))return [{...r,path:r.route,authored:true,label:r.name||atlas.places[r.to]?.name||r.to}];
  if(point(from)&&point(to))return [{...r,path:[from,to],authored:false,label:r.name||atlas.places[r.to]?.name||r.to}];
  return [];
 });
}
export function mapBounds(atlas,connections){
 const points=[];
 for(const p of Object.values(atlas.places||{})){
  const g=p.geometry;if(!point(g?.at))continue;points.push(g.at);
  if(g.size?.length>=2&&g.size.slice(0,2).every(v=>Number.isFinite(v)&&v>0)){const [x,y]=g.at,[w,h]=g.size;points.push([x-w/2,y-h/2],[x+w/2,y+h/2]);}
  for(const l of Object.values(g.landmarks||{}))if(point(l.at)){const r=Number.isFinite(l.radius)&&l.radius>0?l.radius:0;points.push([l.at[0]-r,l.at[1]-r],[l.at[0]+r,l.at[1]+r]);}
 }
 for(const c of connections)points.push(...c.path);
 if(point(atlas.player))points.push(atlas.player);
 if(!points.length)return {xmin:-20,xmax:20,ymin:-20,ymax:20};
 return {xmin:Math.min(...points.map(p=>p[0])),xmax:Math.max(...points.map(p=>p[0])),ymin:Math.min(...points.map(p=>p[1])),ymax:Math.max(...points.map(p=>p[1]))};
}

// Ephemeral markers: intersect the latest visible entities with the latest layout.
export function visibleCharacters(state,{includeUnpositioned=false}={}){
 if(!['Live','Demo'].includes(state?.connection))return [];
 const known=new Set((state.knows||[]).map(p=>p.who||p.id));
 const positions=new Map((state.layout?.present||[]).filter(p=>point(p.at)).map(p=>[p.id,p]));
 return (state.present||[]).filter(p=>p.id!==state.you?.id&&!p.state?.hidden&&(known.has(p.id)||['person','fighter','agent','hireling','drifter','creature','npc','animal'].includes(p.type)||p.state?.playable===true)&&(includeUnpositioned||positions.has(p.id))).map(p=>({id:p.id,name:p.name||p.id,description:p.state?.description||p.description||'',spot:p.spot,...positions.get(p.id)}));
}

// Label boxes use viewport units, independent of the camera's world scale.
export function arrangeLabels(labels,{width=800,height=600,obstacles=[]}={}){
 const occupied=[...obstacles],result=new Map();
 const overlaps=(a,b)=>a.x<b.x+b.width+4&&a.x+a.width+4>b.x&&a.y<b.y+b.height+4&&a.y+a.height+4>b.y;
 for(const label of [...labels].sort((a,b)=>(b.priority||0)-(a.priority||0))){
  if(label.enabled===false||label.x<0||label.x>width||label.y<0||label.y>height){result.set(label.id,null);continue;}
  const w=Math.min(width-24,Math.max(12,label.width)),h=16;
  const candidates=[[12,-10],[12,22],[-w-12,-10],[-w-12,22],[-w/2,-22],[-w/2,34],[12,-38],[-w-12,-38]];
  let placed=null;
  for(const [dx,dy] of candidates){const box={x:label.x+dx,y:label.y+dy-h,width:w,height:h};if(box.x<8||box.x+w>width-8||box.y<8||box.y+h>height-8||occupied.some(other=>overlaps(box,other)))continue;placed={dx,dy,box};break;}
  // A selected or hovered label takes precedence; lower-priority labels yield to it.
  if(!placed&&label.priority>=100){const x=Math.max(8,Math.min(width-w-8,label.x+12)),y=Math.max(8,Math.min(height-h-8,label.y-26));placed={dx:x-label.x,dy:y+h-label.y,box:{x,y,width:w,height:h}};}
  result.set(label.id,placed);if(placed)occupied.push(placed.box);
 }
 return result;
}
