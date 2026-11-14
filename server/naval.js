export const NAVAL_COSTS={shipyard:{wood:2,brick:2,ore:1},dock:{wood:2,brick:1},boat:{wood:2,ore:1},cannons:{wood:1,brick:2,ore:2}};
export const BOAT_CAPACITY=4;
export const isWater=t=>['lake','river'].includes(t?.terrain);
const adjacent=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))===1;
export const coastal=(g,t)=>!isWater(t)&&g.tiles.some(w=>isWater(w)&&adjacent(t,w));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const release=t=>{if(!t.army&&!t.building&&!t.structures.length&&!t.boats&&!t.navy)t.owner=null;};
const spendMove=g=>{if(g.mobilityUsed+1>(g.mobilityCap||2))throw Error('No movement points left.');};
export function performNaval(g,p,action,{pay,battle}){
 const {type}=action;
 if(!['launch','embark','sail','bombard','land','dock'].includes(type))return false;
 const from=g.tiles.find(t=>t.id===action.from),to=g.tiles.find(t=>t.id===action.to);
 if(type==='dock'){
  const tile=g.tiles.find(t=>t.id===action.tile);
  if(!tile||!coastal(g,tile)||tile.owner||tile.structures.length)throw Error('Choose an unclaimed coastal land tile for a landing dock.');
  if(!g.tiles.some(t=>isWater(t)&&t.owner===p.id&&t.navy>0&&t.boats>0&&adjacent(t,tile)))throw Error('A crewed boat must be adjacent to build a landing dock.');
  pay(p,NAVAL_COSTS.dock);tile.owner=p.id;tile.structures.push('dock');return true;
 }
 if(!from||!to||!adjacent(from,to))throw Error('Choose an adjacent naval destination.');
 if(from.owner!==p.id)throw Error('Start from your own territory or fleet.');
 if(type==='launch'){
  if(isWater(from)||!from.structures.includes('shipyard')||!isWater(to))throw Error('Launch from a coastal shipyard into adjacent water.');
  if(to.owner&&to.owner!==p.id)throw Error('Clear enemy forces before launching here.');
  pay(p,NAVAL_COSTS.boat);to.owner=p.id;to.boats=(to.boats||0)+1;return true;
 }
 if(type==='embark'){
  if(isWater(from)||!from.building||!isWater(to)||to.owner!==p.id||!to.boats)throw Error('Embark from your coastal outpost or settlement onto your adjacent boat.');
  const count=action.amount,capacity=to.boats*BOAT_CAPACITY-(to.navy||0);
  if(!integer(count,1,Math.min(from.army-1,capacity)))throw Error('Leave one garrison and respect four troops per boat.');
  from.army-=count;to.navy=(to.navy||0)+count;return true;
 }
 if(!isWater(from)||!from.boats||!from.navy)throw Error('Naval troops need a crewed boat on water.');
 spendMove(g);
 if(type==='bombard'){
  if(!to.owner||to.owner===p.id||!to.army)throw Error('Bombard an adjacent enemy garrison.');
  const damage=Math.min(to.army,Math.ceil(from.navy/2),3),retaliation=to.structures.includes('cannons')?Math.min(from.navy,2):0;
  to.army-=damage;from.navy-=retaliation;
  if(!from.navy){from.boats=0;release(from);}
  g.mobilityUsed++;g.lastBattle={attacker:p.name,defender:to.owner,source:from.id,target:to.id,result:`bombardment: ${damage} enemy troops lost; ${retaliation} naval troops lost`,rounds:[]};return true;
 }
 const count=action.amount;
 if(!integer(count,1,from.navy))throw Error('Choose how many naval troops to move.');
 if(type==='land'){
  if(isWater(to)||!to.structures.includes('dock'))throw Error('Naval troops can land only at a dock.');
  const hostile=to.owner&&to.owner!==p.id;
  const result=hostile?battle(count,to.army,0,to.structures.includes('walls')?1:0):{attackers:count,defenders:0};
  from.navy-=count-result.attackers;
  if(!result.defenders){
   from.navy-=result.attackers;to.owner=p.id;to.army=(hostile?0:to.army)+result.attackers;
   if(hostile){to.structures=to.structures.filter(k=>k!=='walls');to.ward=0;to.attackStock=0;}
  }else to.army=result.defenders;
  // Boats stay afloat at the dock and can pick up a new crew later.
  g.mobilityUsed++;return true;
 }
 if(!isWater(to))throw Error('Boats travel through connected water tiles. Use Land at a dock for shore.');
 const boats=action.boats??Math.ceil(count/BOAT_CAPACITY);
 if(!integer(boats,1,from.boats)||count>boats*BOAT_CAPACITY||from.navy-count>(from.boats-boats)*BOAT_CAPACITY)throw Error('Every naval troop must have boat capacity.');
 const hostile=to.owner&&to.owner!==p.id;
 const defenders=(to.navy||0)+(to.army||0);
 const result=hostile?battle(count,defenders):{attackers:count,defenders:0};
 from.navy-=count-result.attackers;
 if(!result.defenders){
  from.navy-=result.attackers;from.boats-=boats;
  to.owner=p.id;to.navy=(hostile?0:to.navy||0)+result.attackers;to.boats=(hostile?0:to.boats||0)+boats;
  if(hostile)to.army=0;
 }else{
  const lost=defenders-result.defenders;
  to.navy=Math.max(0,(to.navy||0)-lost);to.army=Math.min(to.army,result.defenders);
  if(!result.attackers)from.boats-=boats;
 }
 release(from);g.mobilityUsed++;return true;
}
