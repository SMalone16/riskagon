import {COSTS,RESOURCE_STRUCTURE,adjacent,dist} from './realm.js';
import {isWater,coastal} from './naval.js';
const affordable=(p,kind)=>Object.entries(COSTS[kind]).every(([r,n])=>(p.resources[r]||0)>=n);
export function chooseBotAction(room,context={}){
 const g=room.game,p=room.players[g.turn],own=g.tiles.filter(t=>t.owner===p.id);
 if(!g.rolled)return {type:'roll'};
 if(g.turnStage==='rolling')return null;
 if(g.turnStage==='deploy'){
  const homes=own.filter(t=>t.building&&!isWater(t)).sort((a,b)=>a.army-b.army);
  if(!homes.length)return null;
  return {type:'deploy',tile:homes[0].id,count:Math.min(g.reinforcements[p.id],Math.max(1,Math.ceil(g.reinforcements[p.id]/2)))};
 }
 const stepsLeft=(g.mobilityCap||2)-g.mobilityUsed;
 if(stepsLeft>=1){
  for(const fleet of own.filter(t=>isWater(t)&&t.navy>0&&t.boats>0)){
   const neighbors=g.tiles.filter(t=>adjacent(t,fleet));
   const enemy=neighbors.find(t=>t.owner&&t.owner!==p.id&&t.army>0);
   if(enemy)return {type:'bombard',from:fleet.id,to:enemy.id};
   const landing=neighbors.find(t=>!isWater(t)&&t.structures.includes('dock')&&(!t.owner||t.owner!==p.id&&t.army<fleet.navy||t.owner===p.id&&!t.army&&!t.building));
   if(landing)return {type:'land',from:fleet.id,to:landing.id,amount:fleet.navy};
   const shore=neighbors.find(t=>!isWater(t)&&!t.owner);
   if(shore&&affordable(p,'dock'))return {type:'dock',tile:shore.id};
   const water=neighbors.find(t=>isWater(t)&&!t.owner);
   if(water)return {type:'sail',from:fleet.id,to:water.id,amount:fleet.navy,boats:fleet.boats};
  }
 }
 for(const home of own.filter(t=>t.building&&!isWater(t))){
  const boat=g.tiles.find(t=>adjacent(t,home)&&isWater(t)&&t.owner===p.id&&t.boats>0&&t.navy<t.boats*4);
  if(boat&&home.army>1)return {type:'embark',from:home.id,to:boat.id,amount:Math.min(home.army-1,boat.boats*4-boat.navy)};
  if(home.structures.includes('shipyard')&&affordable(p,'boat')&&!own.some(t=>t.boats)){
   const water=g.tiles.find(t=>adjacent(t,home)&&isWater(t)&&!t.owner);
   if(water)return {type:'launch',from:home.id,to:water.id};
  }
 }
 if((context.builds||0)<1){
  for(const tile of own.filter(t=>!isWater(t)&&!t.building))if(affordable(p,'outpost'))return {type:'build',tile:tile.id,kind:'outpost'};
  for(const tile of own.filter(t=>t.building&&!isWater(t))){
   const options=[...(coastal(g,tile)?['shipyard','dock']:[]),RESOURCE_STRUCTURE[tile.terrain],'barracks','settlement'];
   const kind=options.find(k=>k&&!tile.structures.includes(k)&&affordable(p,k)&&(k==='settlement'?tile.building===1:tile.structures.filter(k=>k!=='settlement').length<5));
   if(kind)return {type:'build',tile:tile.id,kind};
  }
 }
 if(stepsLeft>=1){
  const moves=own.filter(t=>t.army>1).flatMap(from=>g.tiles.filter(to=>adjacent(from,to)&&!isWater(to)&&(!to.owner||to.owner!==p.id&&to.army<from.army-2)).map(to=>({from,to})));
  const waters=g.tiles.filter(isWater);
  moves.sort((a,b)=>Number(!!a.to.owner)-Number(!!b.to.owner)||Math.min(...waters.map(w=>dist(a.to,w)))-Math.min(...waters.map(w=>dist(b.to,w))));
  if(moves[0])return {type:'march',from:moves[0].from.id,to:moves[0].to.id,amount:moves[0].from.army-1};
 }
 return {type:'end'};
}
