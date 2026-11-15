export function knownPeople(character){
  const state=character.state||{},byId=new Map();
  for(const p of [...(character.people||[]),...(state.knows||[])]){
    const id=p.who||p.id;if(id)byId.set(id,{...byId.get(id),...p,id});
  }
  for(const p of state.present||[]){
    if(!byId.has(p.id)&&p.type!=='person')continue;
    const old=byId.get(p.id)||{};
    byId.set(p.id,{...old,id:p.id,name:p.name||old.name,type:p.type,
      description:p.state?.description||p.description||old.description,
      faction:p.state?.faction??p.faction??old.faction});
  }
  const present=new Set((state.present||[]).map(p=>p.id));
  return [...byId.values()].map(p=>({...p,here:present.has(p.id)})).sort((a,b)=>Number(b.here)-Number(a.here)||String(a.name||a.id).localeCompare(String(b.name||b.id)));
}

export function relationshipGroups(relations,selfId){
  const groups=new Map();
  for(const relation of Array.isArray(relations)?relations:[]){
    const kind=relation.relation||relation.kind||relation.type||'connection';
    const members=Array.isArray(relation.participants)?relation.participants:[];
    const other=relation.with||relation.to||relation.b||relation.other;
    const key=other?kind+':'+other:kind+':'+members.join('|')+':'+(relation.id||'');
    let group=groups.get(key);
    if(!group){group={key,kind,other,name:relation.name,members,records:[],links:[]};groups.set(key,group);}
    group.records.push(relation);
    const from=relation.direction==='in'?other:relation.direction==='out'?selfId:relation.from||relation.a||relation.who;
    const to=relation.direction==='in'?selfId:other;
    group.links.push({from,to,direction:relation.direction,standing:relation.data?.standing??relation.data?.value,
      note:relation.data?.as||relation.note||relation.text||relation.data?.note,
      count:relation.data?.count});
  }
  return [...groups.values()];
}
