import {hexEdges,edgeKey,borderBetween} from '../shared/edges.js';
export const resources=['wood','brick','wheat','sheep','ore'];
export const terrainResource={forest:'wood',hills:'brick',fields:'wheat',pasture:'sheep',mountains:'ore'};
const dist=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export const adjacentKingdoms=(g,a,b)=>g.tiles.some(t=>t.owner===a&&(t.army||t.navy)&&g.tiles.some(u=>u.owner===b&&(u.army||u.navy)&&dist(t,u)===1));
export function tavernRate(g,tile,resource){
 if(terrainResource[tile.terrain]===resource)return 1;
 const nearest=Math.min(...g.tiles.filter(t=>terrainResource[t.terrain]===resource).map(t=>dist(t,tile)));
 return Math.min(4,Math.max(2,nearest));
}
export function frontierAction(room,id,a){
 const g=room.game,p=room.players.find(p=>p.id===id);
 if(['road','edgeWall','gate'].includes(a.type)){
  let key=a.edge;
  if(a.vertices?.length===2)key=edgeKey(...a.vertices);
  const touching=g.tiles.filter(t=>hexEdges(t).some(e=>e.key===key));
  if(!touching.length)throw Error('Choose two neighboring vertices on one hex side.');
  if(!touching.some(t=>t.owner===id&&(t.army>0||t.navy>0)))throw Error('Occupy the tile before constructing its border.');
  g.borders??={};const border=g.borders[key]||{};
  if(a.type==='road'){
   if(!touching.every(t=>t.owner===id&&(t.army>0||t.navy>0)))throw Error('Roads require occupation of both adjoining tiles.');
   if(touching.some(t=>!terrainResource[t.terrain]))throw Error('Roads need land.');
   if(border.road)throw Error('A road already exists.');border.road=id;
  }else if(a.type==='edgeWall'){
   if(border.wall)throw Error('A wall already exists here.');
   if(!['wood','stone'].includes(a.material))throw Error('Choose wood or stone.');
   const resource=a.material==='wood'?'wood':'ore',cost=a.material==='wood'?1:2;
   if((p.resources[resource]||0)<cost)throw Error('Not enough resources.');
   p.resources[resource]-=cost;border.wall={owner:id,material:a.material,hp:a.material==='wood'?3:6};
  }else{
   const t=g.tiles.find(t=>t.id===a.tile&&t.owner===id&&hexEdges(t).some(e=>e.key===key));
   if(!t)throw Error('Choose a side of your tile.');
   const count=hexEdges(t).filter(e=>g.borders[e.key]?.gate?.tile===t.id).length;
   if(border.gate||count>=2)throw Error('At most two free gates per tile.');
   if(border.wall&&border.wall.owner!==id)throw Error('Cannot gate an enemy wall.');border.gate={owner:id,tile:t.id};
  }
  g.borders[key]=border;return true;
 }
 if(a.type==='tavernTrade'){
  const t=g.tiles.find(t=>t.id===a.tile);
  if(!t?.tavern||!g.tiles.some(u=>u.owner===id&&(u.army||u.navy)&&dist(t,u)<=1))throw Error('Bring troops within one tile of a tavern.');
  if(!resources.includes(a.give)||!resources.includes(a.receive)||a.give===a.receive||!Number.isSafeInteger(a.count)||a.count<1)throw Error('Choose two resources and a positive trade count.');
  // The tavern sells its local resource 1:1; imported goods cost 2–4 offered units.
  const cost=tavernRate(g,t,a.receive)*a.count;
  if(p.resources[a.give]<cost)throw Error('Not enough resources.');p.resources[a.give]-=cost;p.resources[a.receive]+=a.count;return true;
 }
 if(a.type==='offerTrade'){
  const other=room.players.find(p=>p.id===a.player);
  if(!other||other.id===id||!adjacentKingdoms(g,id,other.id))throw Error('Trading requires adjacent occupied territories.');
  if(!resources.includes(a.give)||!resources.includes(a.receive)||a.give===a.receive||![a.giveCount,a.receiveCount].every(n=>Number.isSafeInteger(n)&&n>0&&n<=999)||p.resources[a.give]<a.giveCount)throw Error('Invalid offer or insufficient resources.');
  g.trade={from:id,to:other.id,give:a.give,receive:a.receive,giveCount:a.giveCount,receiveCount:a.receiveCount};return true;
 }
 return false;
}
export function answerTrade(room,id,a){
 const g=room.game,offer=g?.trade;
 if(!offer||offer.to!==id)throw Error('No trade offer for you.');
 if(a.type==='rejectTrade'){g.trade=null;return;}
 const p=room.players.find(p=>p.id===offer.from),other=room.players.find(p=>p.id===id);
 if(!adjacentKingdoms(g,p.id,id)||p.resources[offer.give]<offer.giveCount||other.resources[offer.receive]<offer.receiveCount)throw Error('Trade no longer valid or affordable.');
 p.resources[offer.give]-=offer.giveCount;other.resources[offer.give]+=offer.giveCount;
 other.resources[offer.receive]-=offer.receiveCount;p.resources[offer.receive]+=offer.receiveCount;g.trade=null;
}
export function wallOn(g,a,b){return g.borders?.[borderBetween(a,b)];}
