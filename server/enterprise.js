import {randomInt} from 'node:crypto';
import {borderBetween,hexEdges} from '../shared/edges.js';
import {CREWS,MATERIALS,PRODUCTS,PLANS,SALES,SALES_GOAL,SITES,hexDist,bonus} from '../shared/enterprise.js';
import {BIOMES} from '../shared/maps.js';
const adjacent=(a,b)=>hexDist(a,b)===1;
const sea=t=>t.biome==='ocean';
const neighborMap=tiles=>new Map(tiles.map(t=>[t.id,tiles.filter(n=>adjacent(t,n))]));
const coastalSite=t=>['beach','keys'].includes(t.biome);
export function initializeBusiness(p){
 Object.assign(p,{cash:1600,sales:0,grade:0,rock:2,compound:2});
 p.resources={wood:2,brick:2,wheat:2,sheep:2,ore:2};
}
export function post(g,p,type,text,tile,kind){
 g.feed??=[];g.postSeq=(g.postSeq||0)+1;
 g.feed.push({seq:g.postSeq,color:p?.color||null,type,text,biome:tile?.biome,kind});if(g.feed.length>100)g.feed.shift();
}
export function market(room){
 const stocks=Object.fromEntries(Object.keys(MATERIALS).map(k=>[k,room.players.reduce((n,p)=>n+(p.resources?.[k]||0),0)]));
 const mean=Object.values(stocks).reduce((a,b)=>a+b,0)/5;
 return Object.fromEntries(Object.entries(stocks).map(([k,n])=>[k,Math.round(Math.min(120,Math.max(25,55*(mean+3)/(n+3))))]));
}
export function quote(p,kind,prices){
 const {cash,...materials}=PLANS[kind];
 return cash+Object.entries(materials).reduce((total,[k,n])=>total+Math.max(0,n-(p.resources[k]||0))*prices[k],0);
}
function charge(room,p,kind,cash){
 const tills=room.game.tiles.filter(t=>t.owner===p.id&&t.till>0);
 const pocket=p.cash-tills.reduce((sum,t)=>sum+t.till,0);
 let draw=Math.max(0,cash-pocket);
 for(const t of tills){const take=Math.min(draw,t.till);t.till-=take;draw-=take;if(!draw)break;}
 p.cash-=cash;
 for(const [k,n] of Object.entries(PLANS[kind]))if(k!=='cash')p.resources[k]=Math.max(0,(p.resources[k]||0)-n);
}
export function earnings(p,t){
 if(t.biome==='pine')p.rock++;
 if(t.biome==='glades')p.compound++;
 if(t.building){const cash=200*t.building;p.cash+=cash;t.till=(t.till||0)+cash;}
}
function connected(g,start,id,neighbors){
 const reached=new Set([start.id]),queue=[start];
 for(const tile of queue)for(const next of neighbors.get(tile.id)){
  if(reached.has(next.id))continue;
  const road=next.owner===id&&tile.owner===id&&g.borders[borderBetween(tile,next)]?.road===id;
  const water=[tile,next].every(t=>sea(t)?!t.owner||t.owner===id:t.owner===id&&t.structures.includes('dock'))&&(sea(tile)||sea(next));
  if(road||water){reached.add(next.id);queue.push(next);}
 }
 return reached;
}
export function businessOrders(room,ordinary){
 const g=room.game,p=room.players[g.turn],prices=market(room),neighbors=neighborMap(g.tiles);
 const result=ordinary.filter(o=>['road','march','embark','sail','land','bombard'].includes(o.type));
 const add=(type,t,target,cash=0)=>result.push({type,tile:t.id,target,cash});
 const offer=(t,kind,target=kind)=>{const cash=quote(p,kind,prices);if(cash<=p.cash)add('enterprise',t,target,cash);};
 for(const t of g.tiles){
  const near=neighbors.get(t.id);
  if(!t.owner&&coastalSite(t)&&near.some(n=>sea(n)&&n.owner===p.id&&n.navy>0))offer(t,'dock');
  if(t.owner!==p.id||sea(t))continue;
  if(!t.building)offer(t,'outpost');
  else{offer(t,'hire');if(t.building===1)offer(t,'settlement');if(!t.structures.includes('barracks'))offer(t,'barracks');}
  for(const [biome,kind] of [['keys','mill'],['beach','works'],['miami','lab']])if(t.biome===biome&&!t.structures.includes(kind))offer(t,kind);
  if(coastalSite(t)&&near.some(sea)&&!t.structures.includes('dock'))offer(t,'dock');
  if(t.structures.includes('dock'))for(const w of near.filter(n=>sea(n)&&(!n.owner||n.owner===p.id)))offer(t,'boat','boat@'+w.id);
  if(t.structures.includes('mill')&&p.rock)add('enterprise',t,'refineRock');
  if(t.structures.includes('works')&&p.compound)add('enterprise',t,'refineCompound');
  if(t.stock?.dust||t.stock?.glue){
   const routes=connected(g,t,p.id,neighbors);
   for(const lab of g.tiles.filter(n=>n.owner===p.id&&n.structures.includes('lab')&&routes.has(n.id)&&n!==t))
    for(const k of ['dust','glue'])if(t.stock[k])add('enterprise',t,k+'@'+lab.id);
  }
  if(t.structures.includes('lab')){
   if(t.stock?.dust&&t.stock?.glue)add('enterprise',t,'craft');
   if(t.stock?.dice>=1)add('enterprise',t,'upgrade');
   for(const n of Object.keys(SALES))if(t.stock?.dice>=Number(n))add('enterprise',t,'sell'+n);
  }
 }
 return result;
}
export function businessAction(room,p,a){
 const g=room.game;
 const option=businessOrders(room,[]).find(o=>o.tile===a.tile&&o.target===a.target);
 if(!option)throw Error('This order needs a valid site, inventory, route and budget.');
 const t=g.tiles.find(t=>t.id===a.tile),[kind,destination]=option.target.split('@'),to=g.tiles.find(n=>n.id===destination);
 t.stock??={dust:0,glue:0,dice:0};
 let message;
 if(Object.hasOwn(PLANS,kind)){
  charge(room,p,kind,option.cash);
  if(kind==='hire')t.army++;
  else if(kind==='boat'){to.owner=p.id;to.boats++;}
  else{t.owner=p.id;t.structures.push(kind);if(kind==='outpost')t.building=1;if(kind==='settlement')t.building=2;}
  message=kind==='hire'?'Signed another '+CREWS[p.color].unit.toLowerCase().replace(/s$/,'')+'.':kind==='boat'?'Skiff in the water.': 'Just built our '+(kind==='outpost'?CREWS[p.color].base:SITES[kind])+' in '+BIOMES[t.biome].name+'.';
 }else if(kind==='refineRock'){p.rock--;t.stock.dust++;message='Fresh Dice Dust from the island mill.';}
 else if(kind==='refineCompound'){p.compound--;t.stock.glue++;message='New batch of Dice Glue off the beach.';}
 else if(destination){to.stock??={dust:0,glue:0,dice:0};to.stock[kind]+=t.stock[kind];t.stock[kind]=0;message=PRODUCTS[kind]+' delivered to our Miami lab.';}
 else if(kind==='craft'){t.stock.dust--;t.stock.glue--;t.stock.dice++;message='A fresh die off the casting table.';}
 else if(kind==='upgrade'){t.stock.dice--;p.grade++;message='Equipped our grade '+p.grade+' custom dice.';}
 else{const n=Number(kind.slice(4));t.stock.dice-=n;p.cash+=SALES[n];p.sales+=SALES[n];t.till=(t.till||0)+SALES[n];message='Moved '+n+' dice for $'+SALES[n]+'.';if(p.sales>=SALES_GOAL){g.phase='finished';g.winner=p.id;}}
 post(g,p,'business',message,t,kind);
}
function report(g,text,t){post(g,null,'police',text,t,'police');}
export function dispatch(room){
 const g=room.game;g.calls=(g.calls||0)+1;
 const candidates=room.players.filter((p,i)=>i!==g.turn&&g.tiles.some(t=>t.owner===p.id&&g.tiles.some(u=>!u.owner&&adjacent(t,u))));
 if(!candidates.length){report(g,'No available approach. Requesting information.',null);return;}
 const p=candidates[randomInt(candidates.length)],free=g.tiles.filter(t=>!t.owner&&g.tiles.some(n=>n.owner===p.id&&adjacent(t,n)));
 const position=free[randomInt(free.length)],target=g.tiles.find(t=>t.owner===p.id&&adjacent(t,position));
 g.policeBattle=null;g.pursuit={id:g.lastRoll.id,target:p.id,position:position.id,against:target.id,strength:g.calls*2,step:1};
 report(g,'Units dispatched near '+BIOMES[target.biome].name+'.',target);
}
export function retreatTiles(g,t){
 return g.tiles.filter(n=>n.owner===t.owner&&adjacent(n,t)&&(!sea(n)||sea(t)||n.boats*4>n.navy));
}
export function policeDecision(room,id,a,battle){
 const g=room.game,c=g.pursuit;
 if(!c||id!==c.target||a.step!==c.step||a.call!==c.id)throw Error('This police response has expired.');
 const t=g.tiles.find(t=>t.id===c.against),p=room.players.find(p=>p.id===id),members=t.army+t.navy;
 let arrests=0;
 if(a.type==='retreat'){
  const allocations=Object.entries(a.allocations||{}),legal=retreatTiles(g,t);
  if(!allocations.length||allocations.some(([key,n])=>!legal.some(u=>u.id===key)||!Number.isSafeInteger(n)||n<0)||allocations.reduce((sum,[,n])=>sum+n,0)!==members)throw Error('Allocate every member to adjacent friendly turf.');
  let boats=t.boats;
  const receiving=allocations.map(([key,n])=>({to:legal.find(u=>u.id===key),n})).filter(entry=>entry.n>0);
  const water=receiving.filter(({to})=>sea(to));
  const needed=water.reduce((sum,{to,n})=>sum+Math.max(0,Math.ceil((to.navy+n)/4)-to.boats),0);
  if(needed>boats)throw Error('Each retreating water crew needs boat capacity. Move the rest to friendly land.');
  for(const {to,n} of receiving){
   if(sea(to)){to.navy+=n;const count=Math.max(0,Math.ceil(to.navy/4)-to.boats);to.boats+=count;boats-=count;}
   else to.army+=n;
  }
  // Empty skiffs accompany the evacuating fleet. Skiffs left behind are seized.
  if(boats&&water.length)water[0].to.boats+=boats;
  post(g,p,'retreat','Crew evacuated before the raid.',t);
 }else if(a.type==='defend'){
  post(g,p,'defend','Standing our ground. Defense dice are on the table.',t);
  const fight=battle(c.strength,members,0,0,0,bonus(p));c.strength=fight.attackers;
  g.policeBattle={...fight,tile:t.id,call:c.id,step:c.step};arrests=members-fight.defenders;
  if(!c.strength){if(sea(t))t.navy=fight.defenders;else t.army=fight.defenders;report(g,'Pursuit lost. Seeking information on '+CREWS[p.color].name+'. Arrests: '+arrests+'.',t);g.pursuit=null;return;}
 }else throw Error('Choose fight or retreat.');
 const cash=Math.min(p.cash,t.till||0),stock=t.stock||{};p.cash-=cash;
 report(g,'Site cleared. Removed '+t.structures.length+' structures. Seized $'+cash+', '+(stock.dice||0)+' dice, '+(stock.dust||0)+' dust and '+(stock.glue||0)+' glue. Arrests: '+arrests+'.',t);
 Object.assign(t,{owner:null,army:0,navy:0,boats:0,building:0,structures:[],stock:null,till:0,ward:0,attackStock:0,bridge:false});
 for(const e of hexEdges(t))delete g.borders[e.key];
 for(const key of Object.keys(g.roads))if(key.split('|').includes(t.id))delete g.roads[key];
 const next=g.tiles.find(n=>n.owner===id&&adjacent(n,t));
 if(next){c.position=t.id;c.against=next.id;c.step++;}
 else{g.pursuit=null;report(g,'Trail ran cold. Witness information requested for '+CREWS[p.color].name+'.',t);}
}

// Use the same quoted commands a human can submit. Expansion favors missing production biomes.
export function businessBot(room,steps){
 const g=room.game,p=room.players[g.turn],opts=room.orders||[],own=g.tiles.filter(t=>t.owner===p.id);
 if(steps>=16)return {type:'end'};
 const actions=opts.filter(o=>o.type==='enterprise');
 const take=o=>({type:'enterprise',tile:o.tile,target:o.target});
 const buy=k=>actions.find(o=>o.target===k);
 const aggressive=['aggro','navalAggro'].includes(p.profile);
 const batch=p.profile==='steady'||p.profile==='homebody'?4:2;
 const sales=[8,4,2,1].filter(n=>n>=batch||p.cash<250).map(n=>'sell'+n);
 for(const item of [...(p.grade<(aggressive?3:1)?['upgrade']:[]),...sales,'craft','refineRock','refineCompound']){
  if(buy(item))return take(buy(item));
 }
 const shipment=actions.find(o=>/^(dust|glue)@/.test(o.target));if(shipment)return take(shipment);
 for(const site of ['mill','works','lab'])if(buy(site)&&!own.some(t=>t.structures.includes(site)))return take(buy(site));
 const road=opts.find(o=>o.type==='road'&&own.filter(t=>hexEdges(t).some(e=>e.key===o.target)).length===2);
 if(road)return {type:'road',edge:road.target};
 const destinations=g.tiles.filter(t=>!own.some(u=>u.biome===t.biome)&&!sea(t));
 const moves=opts.filter(o=>o.type==='march'&&g.tiles.find(t=>t.id===o.target)?.owner!==p.id);
 const rank=o=>{const t=g.tiles.find(t=>t.id===o.target);return Math.min(20,...destinations.map(d=>hexDist(t,d)))+(t.owner?(aggressive?-1:4):0);};
 moves.sort((a,b)=>rank(a)-rank(b));if(moves.length)return {type:'march',from:moves[0].tile,to:moves[0].target,amount:moves[0].max};
 if(p.cash>350&&buy('dock'))return take(buy('dock'));
 const ferry=actions.find(o=>o.target.startsWith('boat@'));if(ferry&&!own.some(t=>t.boats))return take(ferry);
 for(const type of ['embark','land','sail']){
  const o=opts.find(o=>o.type===type&&(type==='embark'||!own.some(t=>t.id===o.target)));
  if(o)return {type,from:o.tile,to:o.target,amount:o.max};
 }
 if(p.cash>300&&buy('outpost'))return take(buy('outpost'));
 if(p.cash>300&&buy('hire')&&steps<5)return take(buy('hire'));
 return {type:'end'};
}
