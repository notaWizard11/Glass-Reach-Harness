const movement=new Set(['arrived','left','moved','following','stayed','boarded','alighted']);
// Use the archive's scene boundaries even when rows are filtered or paginated.
export function groupStoryRows(rows,scenes=[]){
  const ordered=[...scenes].sort((a,b)=>a.start-b.start),groups=[];
  for(const row of rows){
    let lo=0,hi=ordered.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(ordered[mid].start<=row.order)lo=mid+1;else hi=mid;}
    const scene=ordered[lo-1]||null,key=scene?.id||'unplaced';
    let group=groups.at(-1);
    if(!group||group.key!==key){group={key,scene,rows:[]};groups.push(group);}
    group.rows.push(row);
  }
  return groups;
}
export function storyRows(events,messages){
  const lastSeq=Math.max(0,...events.map(e=>Number(e.seq)||0));
  const anchored=messages.filter(m=>Number.isFinite(m.timelineSeq)).map(m=>m.timelineSeq);
  const legacyAnchor=anchored.length?Math.min(...anchored):lastSeq;
  const rows=events.map(e=>{
    const category=e.kind==='say'?'say':movement.has(e.kind)?'movement':e.kind==='act'?'action':e.kind==='scene'||e.payload?.text?'description':'event';
    const label={say:'Dialogue',movement:'Movement · '+e.kind,action:'Game action',description:'The world',event:'Game event · '+e.kind.replaceAll('_',' ')}[category];
    return {id:'event-'+e.seq,event:e,category,label,order:Number(e.seq)||0,tie:0};
  });
  let mode='chat';
  messages.forEach((m,i)=>{
    if(m.role==='user')mode=m.mode||'chat';
    const game=(m.mode||mode)==='game';
    const category=m.role==='error'?'error':m.execution?'action':m.role==='notice'?'notice':game?(m.role==='user'?'player':'result'):'thought';
    const label=m.role==='error'?'Connection / request issue':m.execution?'Action record':m.role==='notice'?'Watch / system':game?(m.role==='user'?'You · Action / dialogue':'The story · Outcome'):(m.role==='user'?'You · Inner question':'Inner thoughts');
    rows.push({id:'message-'+(m.id||i),message:m,category,label,order:Number.isFinite(m.timelineSeq)?m.timelineSeq:legacyAnchor,tie:i+1});
  });
  return rows.sort((a,b)=>a.order-b.order||a.tie-b.tie);
}
