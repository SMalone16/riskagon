import {hexEdges,borderBetween} from '../shared/edges.js';
import {isWater,BOAT_CAPACITY} from './naval.js';
import {ready} from './movement.js';
import {terrainResource,tavernRate} from './frontier.js';

const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
const occupied=t=>t.army>0||t.navy>0;

// Advertise actionable targets once, from the authoritative state. Only the active seat receives them.
export function availableOrders(room,costs,industries){
 const g=room.game,p=room.players[g.turn],id=p.id,orders=[];
 const afford=cost=>Object.entries(cost).every(([r,n])=>(p.resources[r]||0)>=n);
 const add=(type,t,target,max,min=1)=>orders.push({type,tile:t.id,target,max,min});
 const edges=new Map();
 for(const tile of g.tiles)for(const {key} of hexEdges(tile)){
  if(!edges.has(key))edges.set(key,[]);
  edges.get(key).push(tile);
 }
 for(const tile of g.tiles.filter(t=>t.owner===id)){
  const neighbors=g.tiles.filter(t=>distance(tile,t)===1);
  if(!isWater(tile)){
   const recipes=tile.building?Object.keys(costs).filter(k=>!['road','bridge','boat','outpost'].includes(k)):['outpost'];
   for(const kind of recipes){
    if(!afford(costs[kind])||tile.structures.includes(kind))continue;
    if(kind==='settlement'?tile.building!==1:tile.building&&tile.structures.filter(k=>k!=='settlement').length>=5)continue;
    if(['dock','shipyard'].includes(kind)&&!neighbors.some(isWater))continue;
    if(Object.values(industries).includes(kind)&&industries[tile.terrain]!==kind)continue;
    add('build',tile,kind);
   }
  }
  if(occupied(tile)){
   const sides=hexEdges(tile),gates=sides.filter(e=>g.borders?.[e.key]?.gate?.tile===tile.id).length;
   for(const {key} of sides){
    const b=g.borders?.[key]||{};
    if(!b.road&&edges.get(key).every(t=>t.owner===id&&occupied(t)&&terrainResource[t.terrain]))add('road',tile,key);
    if(!b.wall&&p.resources.wood>=1)add('wood',tile,key);
    if(!b.wall&&p.resources.ore>=2)add('stone',tile,key);
    if(!b.gate&&gates<2&&(!b.wall||b.wall.owner===id))add('gate',tile,key);
   }
  }
  for(const to of neighbors){
   const b=g.borders?.[borderBetween(tile,to)],passable=b?.wall?.owner!==id||b.gate;
   if(to.terrain==='river'&&!to.bridge&&afford(costs.bridge))add('bridge',to);
   if(tile.army>1&&(!isWater(to)||to.bridge===id)&&passable){
    const road=b?.road===id||g.roads?.[[tile.id,to.id].sort().join('|')]===id;
    const max=Math.min(tile.army-1,ready(g,tile,'army',road ? .5 : 1));
    if(max)add('march',tile,to.id,max);
   }
   if(isWater(to)&&(!to.owner||to.owner===id)&&tile.structures.includes('shipyard')&&afford(costs.boat))add('launch',tile,to.id);
   if((tile.building||g.mapId==='florida'&&tile.structures.includes('dock'))&&to.owner===id&&isWater(to)&&to.boats){
    const max=Math.min(tile.army-1,ready(g,tile,'army',.5),to.boats*BOAT_CAPACITY-to.navy);
    if(max>0)add('embark',tile,to.id,max);
   }
   if(isWater(tile)&&tile.navy&&tile.boats){
    const max=ready(g,tile,'navy',.5);
    const min=Math.max(1,tile.navy-(tile.boats-1)*BOAT_CAPACITY);
    if(isWater(to)&&max>=min)add('sail',tile,to.id,max,min);
    if(!isWater(to)&&to.structures.includes('dock')&&max&&passable)add('land',tile,to.id,max);
    if(to.owner&&to.owner!==id&&to.army&&ready(g,tile,'navy',1)>=tile.navy)add('bombard',tile,to.id);
    if(!isWater(to)&&!to.owner&&!to.structures.length&&afford(costs.dock))add('landingDock',to);
   }
   if(occupied(tile)&&occupied(to)&&to.owner&&to.owner!==id&&Object.values(p.resources).some(n=>n>0))add('trade',tile,to.owner);
  }
  if(occupied(tile))for(const t of [tile,...neighbors].filter(t=>t.tavern)){
   if(Object.values(terrainResource).some(receive=>Object.entries(p.resources).some(([give,n])=>give!==receive&&n>=tavernRate(g,t,receive))))add('trade',tile,'tavern:'+t.id);
  }
 }
 return orders;
}
