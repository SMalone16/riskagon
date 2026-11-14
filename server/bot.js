import {ready} from './movement.js';
import {adjacentKingdoms} from './frontier.js';
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
 const profile=p.profile||'steady',aggressive=['aggro','navalAggro'].includes(profile),naval=['navy','navalAggro'].includes(profile),retaliate=g.provoked?.[p.id];
 if((context.steps||0)>12)return {type:'end'};
 if(profile==='explorer'&&!context.traded){const target=room.players.find(o=>o.id!==p.id&&adjacentKingdoms(g,p.id,o.id));const give=Object.keys(p.resources).find(r=>p.resources[r]>2);if(target&&give){context.traded=true;return {type:'offerTrade',player:target.id,give,receive:give==='wood'?'ore':'wood',giveCount:1,receiveCount:1};}}
 const stepsLeft=2;
 if(stepsLeft>=1){
  for(const fleet of own.filter(t=>isWater(t)&&t.navy>0&&t.boats>0&&ready(g,t,'navy',.5)>0)){
   const neighbors=g.tiles.filter(t=>adjacent(t,fleet));
   if(!aggressive&&!retaliate&&profile!=='navy'&&profile!=='steady'&&profile!=='homebody')continue;
   const enemy=neighbors.find(t=>t.owner&&t.owner!==p.id&&t.army>0);
   if(enemy&&(aggressive||retaliate===enemy.owner)&&ready(g,fleet,'navy',1)>=fleet.navy)return {type:'bombard',from:fleet.id,to:enemy.id};
   const landing=neighbors.find(t=>!isWater(t)&&t.structures.includes('dock')&&(!t.owner||t.owner===p.id||aggressive||retaliate===t.owner)&&(!t.owner||t.owner!==p.id&&t.army<fleet.navy||t.owner===p.id&&!t.army&&!t.building));
   if(landing)return {type:'land',from:fleet.id,to:landing.id,amount:Math.min(fleet.navy,ready(g,fleet,'navy',.5))};
   const shore=neighbors.find(t=>!isWater(t)&&!t.owner);
   if(shore&&affordable(p,'dock'))return {type:'dock',tile:shore.id};
   const water=neighbors.find(t=>isWater(t)&&!t.owner);
   if(water)return {type:'sail',from:fleet.id,to:water.id,amount:Math.min(fleet.navy,ready(g,fleet,'navy',.5)),boats:fleet.boats};
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
 if((context.builds||0)<1&&profile!=='aggro'){
  for(const tile of own.filter(t=>!isWater(t)&&!t.building))if(affordable(p,'outpost'))return {type:'build',tile:tile.id,kind:'outpost'};
  for(const tile of own.filter(t=>t.building&&!isWater(t))){
   const options=[...(naval&&coastal(g,tile)?['shipyard','dock']:[]),...(profile==='homebody'?['settlement','barracks']:[]),RESOURCE_STRUCTURE[tile.terrain],'barracks','settlement'];
   const kind=options.find(k=>k&&!tile.structures.includes(k)&&affordable(p,k)&&(k==='settlement'?tile.building===1:tile.structures.filter(k=>k!=='settlement').length<5));
   if(kind)return {type:'build',tile:tile.id,kind};
  }
 }
 if(stepsLeft>=1){
  const moves=own.filter(t=>t.army>1&&ready(g,t,'army',1)>0).flatMap(from=>g.tiles.filter(to=>adjacent(from,to)&&!isWater(to)&&(!to.owner||to.owner!==p.id&&(aggressive||retaliate===to.owner)&&to.army<from.army-2)).map(to=>({from,to})));
  const waters=g.tiles.filter(isWater),home=g.tiles.find(t=>t.id===p.home)||own.find(t=>t.building)||own[0];
  if(profile==='homebody'){for(let i=moves.length-1;i>=0;i--)if(dist(moves[i].to,home)>2||own.some(t=>t.terrain===moves[i].to.terrain))moves.splice(i,1);}
  if(profile==='steady'){for(let i=moves.length-1;i>=0;i--)if(moves[i].from.army<4)moves.splice(i,1);}
  moves.sort((a,b)=>(aggressive?Number(!!b.to.owner)-Number(!!a.to.owner):Number(!!a.to.owner)-Number(!!b.to.owner))||(profile==='explorer'?Number((g.discovered[p.id]||[]).includes(a.to.id))-Number((g.discovered[p.id]||[]).includes(b.to.id)):0)||Math.min(...waters.map(w=>dist(a.to,w)))-Math.min(...waters.map(w=>dist(b.to,w))));
  if(moves[0])return {type:'march',from:moves[0].from.id,to:moves[0].to.id,amount:Math.min(moves[0].from.army-(profile==='steady'?2:1),ready(g,moves[0].from,'army',1))};
 }
 return {type:'end'};
}
