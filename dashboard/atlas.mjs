export const point=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite);
// Geometry is captured only from player observations, never inferred from prose.
export function captureAtlas(character, observation) {
  if(!observation?.world||!observation.here?.id)return;
  const worlds=character.atlasWorlds??={};
  const atlas=worlds[observation.world]??={places:{},routes:{}};
  const stamp=observation.updated||new Date().toISOString();
  for(const p of [...(observation.known_places||[]),observation.here]) {
    atlas.places[p.id]={...atlas.places[p.id],id:p.id,name:p.name,...(p.state?.description?{description:p.state.description}:{})};
  }
  const id=observation.here.id,layout=observation.layout;
  const place=atlas.places[id];
  place.observedAt=stamp;
  place.parent=observation.here.breadcrumb?.[0]?.id;
  if(point(layout?.here?.at))place.geometry=structuredClone(layout.here);
  if(layout?.frame)atlas.frame=structuredClone(layout.frame);
  for(const exit of observation.exits||[]) {
    atlas.places[exit.to]??={id:exit.to,name:exit.name};
    atlas.routes[id+'>'+exit.to]={...exit,from:id,observedAt:stamp,metrics:layout?.exits?.find(e=>e.to===exit.to)};
  }
  atlas.current=id;
  atlas.player=point(layout?.you)?layout.you:null;
  atlas.updated=stamp;
}
