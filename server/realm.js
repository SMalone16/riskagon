
import {frontierAction,answerTrade,tavernRate,wallOn} from './frontier.js';
import {prepareMovement,ready} from './movement.js';
import {hexEdges,borderBetween} from '../shared/edges.js';
import {randomInt} from 'node:crypto';
import {rollPhysics,simulateRoll} from './dicePhysics.js';
import {NAVAL_COSTS,isWater,coastal,performNaval} from './naval.js';
export const COLORS=['blue','red','green','yellow'];
export const RESOURCES=['wood','brick','wheat','sheep','ore'];
export const RADIUS=5;
export const TARGET_POINTS=32;
export const COSTS={...NAVAL_COSTS,
 road:{wood:1,brick:1},outpost:{wood:1,brick:1},settlement:{wood:2,brick:2,wheat:2,sheep:1},
 homes:{wood:2,brick:1,wheat:1},
 walls:{brick:2,ore:1},
 armory:{ore:2,brick:1},
 farm:{wood:2,wheat:1},
 lumberyard:{wood:1,brick:1},
 quarry:{wood:1,brick:2},
 mine:{wood:2,ore:1},
 ranch:{wood:1,sheep:2},
 barracks:{wood:2,brick:2,ore:1},
 stables:{wood:2,wheat:2,sheep:1},
 bridge:{wood:2,brick:1,ore:1}
};
export const RESOURCE_TERRAIN={forest:'wood',hills:'brick',fields:'wheat',pasture:'sheep',mountains:'ore'};
export const RESOURCE_STRUCTURE={forest:'lumberyard',hills:'quarry',fields:'farm',pasture:'ranch',mountains:'mine'};
const shuffle=a=>{
 const copy=[...a];for(let i=copy.length-1;i>0;i--){const j=randomInt(0,i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;
};
export const axialId=(q,r)=>q+','+r;
export const dist=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export const adjacent=(a,b)=>dist(a,b)===1;
export const edgeId=(a,b)=>[a,b].sort().join('|');
export function generateMap(){
 const cells=[];
 for(let q=-RADIUS;q<=RADIUS;q++)for(let r=-RADIUS;r<=RADIUS;r++)if(Math.abs(q+r)<=RADIUS){
  cells.push({q,r,id:axialId(q,r),terrain:null,number:null,owner:null,army:0,building:0,structures:[],ward:0,attackStock:0,bridge:false,navy:0,boats:0});
 }
 const byId=new Map(cells.map(t=>[t.id,t]));
 // Large, connected terrain provinces (3-12 hexes), deliberately not shuffled per individual tile.
 const remaining=new Set(byId.keys());
 let cluster=0;
 const resources=['forest','fields','pasture','hills','mountains'];
 const terrainNames=shuffle([...resources,...resources,...resources,...resources]);
 while(remaining.size){
  const start=shuffle([...remaining])[0],target=3+randomInt(0,10);
  const terrain=terrainNames[cluster++%terrainNames.length];
  const chosen=[start];remaining.delete(start);
  while(chosen.length<target){
   const neighbors=chosen.flatMap(id=>{
    const t=byId.get(id);
    return cells.filter(x=>remaining.has(x.id)&&adjacent(t,x)).map(x=>x.id);
   });
   if(!neighbors.length)break;
   const next=neighbors[randomInt(0,neighbors.length)];chosen.push(next);remaining.delete(next);
  }
  for(const id of chosen)byId.get(id).terrain=terrain;
 }
 // One enclosed lake and a short, shallower river; both are visible terrain from the outset.
 for(const id of ['0,0','1,0','0,1','-1,1','1,-1']){
  const t=byId.get(id);if(t)t.terrain='lake';
 }
 for(const id of ['-3,1','-2,1','-2,2','-1,2']){
  const t=byId.get(id);if(t)t.terrain='river';
 }
 const numberBag=shuffle([2,12,...Array(18).fill([3,4,5,6,8,9,10,11]).flat()].flat());
 const candidates=cells.filter(t=>RESOURCE_TERRAIN[t.terrain]);
 candidates.forEach((t,i)=>{t.number=numberBag[i%numberBag.length];});
 for(const t of shuffle(cells.filter(t=>RESOURCE_TERRAIN[t.terrain])).slice(0,4))t.tavern=true;
 return cells;
}
const choices=()=>['-5,0','5,0','0,-5','0,5','-5,5','5,-5','-3,-2','3,2'];
export function newRealm(players){
 return {phase:'draft',draftStage:'color',draftOrder:players.map(p=>p.id),draftIndex:0,spawnChoices:choices(),tiles:generateMap(),roads:{},borders:{},movement:{},trade:null,provoked:{},turn:0,round:1,rolled:false,turnStage:'roll',lastRoll:null,lastBattle:null,mobilityUsed:0,reinforcements:{},productionReserve:{},allocations:{},discovered:{},events:[],eventSeq:0,pendingDice:null,winner:null,log:['Color draft is open. Choose a banner.']};
}
export function currentDrafter(room){
 const g=room.game;if(!g||g.phase!=='draft')return null;
 const order=g.draftStage==='color'?g.draftOrder:[...g.draftOrder].reverse();
 return order[g.draftIndex];
}
export const tileAt=(g,id)=>g.tiles.find(t=>t.id===id);
const pay=(p,cost)=>{if(Object.entries(cost).some(([key,n])=>(p.resources?.[key]||0)<n))throw Error('Not enough resources to build this.');for(const [key,n] of Object.entries(cost))p.resources[key]-=n;};
export function chooseDraft(room,id,kind,value){
 const g=room.game;
 if(g?.phase!=='draft'||id!==currentDrafter(room))throw Error('Wait for your turn in the draft.');
 const p=room.players.find(x=>x.id===id);
 if(g.draftStage==='color'){
  if(kind!=='color'||!COLORS.includes(value)||room.players.some(x=>x.color===value))throw Error('Pick an available banner color.');
  p.color=value;g.log.unshift(p.name+' drafted the '+value+' banner.');
 }else{
  if(kind!=='spawn'||!g.spawnChoices.includes(value))throw Error('Pick one of the glowing spawn hexes.');
  const tile=tileAt(g,value);
  if(!tile||tile.owner||['lake','river'].includes(tile.terrain))throw Error('That starting location is not available.');
  p.home=tile.id;tile.owner=id;tile.army=3;tile.building=1;tile.structures=['outpost'];
  p.resources={wood:1,brick:1,wheat:1,sheep:1,ore:0};
  g.spawnChoices=g.spawnChoices.filter(x=>x!==value);
  g.log.unshift(p.name+' claimed a starting outpost.');
 }
 g.draftIndex++;
 if(g.draftStage==='color'&&g.draftIndex>=room.players.length){
  g.draftStage='spawn';g.draftIndex=0;
  g.log.unshift('Starting location draft is open, in reverse order.');
 }else if(g.draftStage==='spawn'&&g.draftIndex>=room.players.length){
  g.phase='playing';g.turn=0;g.round=1;g.rolled=false;g.turnStage='roll';
  g.mobilityUsed=0;g.log.unshift('The frontier opens. Every kingdom starts with 3 troops.');
  for(const x of room.players)g.reinforcements[x.id]=0;
  discover(room);
 }
 g.log=g.log.slice(0,20);
}
export function points(g,id){
 return g.tiles.filter(t=>t.owner===id).reduce((n,t)=>n+1+(t.building?1:0)+t.structures.filter(x=>!['outpost'].includes(x)).length,0);
}
function diceBattle(aCount,dCount,bonusA=0,bonusD=0){
 let a=aCount,d=dCount;const rounds=[];
 for(let turns=0;a>0&&d>0&&turns<100;turns++){
  const attackerCount=Math.min(3,a),defenderCount=Math.min(2,d);
  const rolled=rollPhysics(attackerCount+defenderCount);
  const as=rolled.slice(0,attackerCount).sort((x,y)=>y-x);
  const ds=rolled.slice(attackerCount).sort((x,y)=>y-x);
  if(bonusA)as[0]=Math.min(6,as[0]+bonusA);
  if(bonusD)ds[0]=Math.min(6,ds[0]+bonusD);
  let lostA=0,lostD=0;
  for(let i=0;i<Math.min(as.length,ds.length);i++)if(as[i]>ds[i]){d--;lostD++;}else{a--;lostA++;}
  rounds.push({attack:as,defense:ds,lostA,lostD});
 }
 return {attackers:a,defenders:d,rounds};
}
// Outposts upgrade into settlements: their base outputs replace, rather than stack.
export const troopOutput=tile=>(tile.building>=2?3:tile.building===1?2:0)+(tile.structures.includes('barracks')?3:0);
export function reinforcementIncome(g,id,sum){
 const owned=g.tiles.filter(t=>t.owner===id);
 const occupied=Object.fromEntries(RESOURCES.map(r=>[r,0]));
 for(const t of owned)if(t.army>0&&RESOURCE_TERRAIN[t.terrain])occupied[RESOURCE_TERRAIN[t.terrain]]++;
 const pairs=Object.fromEntries(Object.entries(occupied).map(([r,n])=>[r,Math.floor(n/2)]));
 const territory=Object.values(pairs).reduce((a,b)=>a+b,0);
 const outposts=owned.filter(t=>t.building===1).length*2,settlements=owned.filter(t=>t.building>=2).length*3,barracks=owned.filter(t=>t.structures.includes('barracks')).length*3;
 const structures=outposts+settlements+barracks;
 const production=owned.filter(t=>t.number===sum&&RESOURCE_TERRAIN[t.terrain]).reduce((n,t)=>n+troopOutput(t),0);
 // Protect the opening round; production is delayed too, so nobody starts with a rush army.
 const opening=g.round===1;
 return {pairs,outposts:opening?0:outposts,settlements:opening?0:settlements,barracks:opening?0:barracks,territory:opening?0:territory,structures:opening?0:structures,production:opening?0:production,opening,
  total:opening?0:territory+structures+production};
}
export function finishRoll(room,now=Date.now()){
 const g=room.game;
 if(g?.turnStage!=='rolling'||now<g.lastRoll.readyAt)return false;
 const p=room.players[g.turn],sum=g.lastRoll.sum;
 for(const tile of g.tiles){
  if(tile.number!==sum||!tile.owner)continue;
  const owner=room.players.find(x=>x.id===tile.owner),resource=RESOURCE_TERRAIN[tile.terrain];
  if(resource&&owner){
   const count=1+(tile.structures.includes('homes')?1:0)+(tile.structures.includes(RESOURCE_STRUCTURE[tile.terrain])?2:0);
   owner.resources[resource]=(owner.resources[resource]||0)+count;
  }
  if(g.round>1&&owner&&resource)g.productionReserve[owner.id]=(g.productionReserve[owner.id]||0)+troopOutput(tile);
  if(tile.structures.includes('walls'))tile.ward=Math.min(3,tile.ward+1);
  if(tile.structures.includes('armory'))tile.attackStock=Math.min(3,tile.attackStock+1);

 }
 g.income=reinforcementIncome(g,p.id,null);
 g.income.production=g.productionReserve[p.id]||0;
 g.income.total+=g.income.production;
 g.productionReserve[p.id]=0;
 // A conquered kingdom with only bridge hexes cannot get trapped with an unusable reserve.
 const canDeploy=g.tiles.some(t=>t.owner===p.id&&t.building&&!isWater(t));
 g.reinforcements[p.id]=canDeploy?g.income.total:0;
 g.allocations[p.id]={};
 g.turnStage=g.reinforcements[p.id]>0?'deploy':'orders';
 g.log.unshift(p.name+' rolled '+g.lastRoll.dice.join(' + ')+' = '+sum+'. '+g.reinforcements[p.id]+' troops to place.');
 g.log=g.log.slice(0,20);
 return true;
}
function performAction(room,id,action){
 const g=room.game,p=room.players.find(x=>x.id===id);
 if(g?.phase!=='playing')throw Error('The match is not currently playing.');
 if(!p||room.players[g.turn].id!==id)throw Error('Not your turn.');
 const t=action?.type;
 if(t==='roll'){
  if(g.rolled||g.turnStage!=='roll')throw Error('Already rolled this turn.');
  const roll=simulateRoll(2,action.throw,g.tiles);
  g.rolled=true;g.turnStage='rolling';g.lastRoll=roll;
  g.lastRoll.startedAt=Date.now();
  g.lastRoll.readyAt=g.lastRoll.startedAt+roll.durationMs;
 }else if(t==='end'){
  if(!g.rolled)throw Error('Roll the dice before ending your turn.');
  if(g.turnStage!=='orders')throw Error('Finish rolling and place all reinforcements before ending your turn.');
  g.turn=(g.turn+1)%room.players.length;if(g.turn===0)g.round++;
  g.rolled=false;g.turnStage='roll';g.lastRoll=null;g.lastBattle=null;g.income=null;
  g.mobilityUsed=0;g.movement={};g.trade=null;
  const next=room.players[g.turn];
  g.mobilityCap=2;
  next.storedMobility=0;
  g.reinforcements[next.id]=0;
  g.log.unshift('Round '+g.round+': '+next.name+' prepares their orders.');
 }else{
  if(!g.rolled)throw Error('Roll your physical dice before taking actions.');
  if(g.turnStage==='rolling')throw Error('Wait for the dice to settle.');
  if(!['deploy','allocate','confirmDeployment'].includes(t)&&g.turnStage!=='orders')throw Error('Place all reinforcements before movement, combat or building.');
  if(frontierAction(room,id,action)){
   g.log.unshift(p.name+' developed the frontier.');
  }else if(performNaval(g,p,action,{pay,battle:diceBattle})){
   if(g.lastBattle?.defender){const defender=room.players.find(x=>x.id===g.lastBattle.defender);if(defender)g.lastBattle.defender=defender.name;}
   g.log.unshift(p.name+' issued naval orders.');
  }else if(t==='bridge'){
   const tile=tileAt(g,action.tile);
   if(!tile||tile.terrain!=='river'||tile.bridge)throw Error('Choose an unbridged river hex.');
   if(!g.tiles.some(x=>x.owner===id&&adjacent(x,tile)))throw Error('Bridge must connect to owned land.');
   pay(p,COSTS.bridge);tile.bridge=id;
   g.log.unshift(p.name+' built a bridge across the river.');
  }else if(t==='build'){
   const tile=tileAt(g,action.tile),kind=action.kind;
   if(!tile||tile.owner!==id)throw Error('Build on your territory.');
   if(!COSTS[kind]||['road','bridge','boat'].includes(kind))throw Error('Unknown structure.');
   if(isWater(tile))throw Error('Structures must be built on land.');
   if(['shipyard','dock'].includes(kind)&&!coastal(g,tile))throw Error('Shipyards and docks need coastal land.');
   if(tile.structures.includes(kind))throw Error('Structure is already built.');
   if(kind==='settlement'&&tile.building!==1)throw Error('Upgrade an outpost to a settlement.');
   if(kind==='outpost'){
    if(tile.building)throw Error('Outpost already exists.');
   }else{
    if(!tile.building)throw Error('Build an outpost first.');
    if(tile.structures.filter(x=>x!=='settlement').length>=5&&kind!=='settlement')throw Error('This settlement has reached its five-building limit.');
    if(['farm','lumberyard','quarry','mine','ranch'].includes(kind)&&RESOURCE_STRUCTURE[tile.terrain]!==kind)throw Error('This industry does not match the terrain.');
   }
   pay(p,COSTS[kind]);tile.structures.push(kind);
   if(kind==='outpost')tile.building=1;
   if(kind==='settlement')tile.building=2;
   g.log.unshift(p.name+' constructed '+kind+' in '+tile.terrain+'.');
  }else if(t==='allocate'){
   if(g.turnStage!=='deploy')throw Error('Allocation is only available during reinforcements.');
   const tile=tileAt(g,action.tile),count=action.count;
   if(!tile||tile.owner!==id||!tile.building||isWater(tile))throw Error('Allocate troops only at your outposts or settlements.');
   const plan=g.allocations[id]||{},previous=plan[tile.id]||0;
   if(!Number.isSafeInteger(count)||count<0||count-previous>(g.reinforcements[id]||0))throw Error('Invalid troop allocation or not enough reinforcements.');
   g.allocations[id]={...plan,[tile.id]:count};g.reinforcements[id]-=count-previous;
  }else if(t==='confirmDeployment'){
   if(g.turnStage!=='deploy'||g.reinforcements[id]!==0)throw Error('Allocate every reinforcement before confirming.');
   const plan=Object.entries(g.allocations[id]||{}).filter(([,n])=>n>0);
   if(!plan.length||plan.some(([key])=>{const tile=tileAt(g,key);return !tile||tile.owner!==id||!tile.building||isWater(tile);}))throw Error('Every allocation needs an owned outpost or settlement.');
   for(const [key,n] of plan)tileAt(g,key).army+=n;
   g.allocations[id]={};g.turnStage='orders';
  }else if(t==='deploy'){
   const tile=tileAt(g,action.tile),count=action.count;
   if(g.turnStage!=='deploy')throw Error('Not enough reinforcements remaining; deployment is only at the start of a turn.');
   if(!tile||tile.owner!==id||!tile.building||isWater(tile))throw Error('Deploy only at your outposts or settlements.');
   if(Object.values(g.allocations[id]||{}).some(n=>n>0))throw Error('Confirm or clear your planned allocations first.');
   if(!Number.isSafeInteger(count)||count<1||(g.reinforcements[id]||0)<count)throw Error('Not enough reinforcements remaining.');
   tile.army+=count;g.reinforcements[id]-=count;
   if(g.reinforcements[id]===0)g.turnStage='orders';
   g.log.unshift(p.name+' deployed '+count+' free reinforcements.');
  }else if(t==='march'){
   const from=tileAt(g,action.from),to=tileAt(g,action.to),count=action.amount;
   if(!from||!to||!adjacent(from,to))throw Error('March to an adjacent hex.');
   if(from.owner!==id)throw Error('March from your own territory.');
   if(!Number.isSafeInteger(count)||count<1||count>=from.army)throw Error('Keep at least one soldier at home.');
   if(to.terrain==='lake')throw Error('Use a boat and a dock to cross the lake.');
   if(to.terrain==='river'&&to.bridge!==id)throw Error('Construct a bridge before crossing this river.');
   const road=g.borders?.[borderBetween(from,to)]?.road===id||g.roads[edgeId(from.id,to.id)]===id;
   const mobilityCost=road?0.5:1;
   const border=wallOn(g,from,to);
   if(border?.wall&&border.wall.owner!==id&&!(border.gate?.owner===id)){border.wall.hp-=Math.min(3,count);if(border.wall.hp<=0)delete border.wall;return;}
   if(border?.wall&&border.wall.owner===id&&!border.gate)throw Error('Build a gate to cross your wall.');
   const battle=to.owner&&to.owner!==id?diceBattle(count,to.army,(road?1:0)+(from.attackStock>0?1:0),(to.structures.includes('walls')?1:0)+(to.ward>0?1:0)):null;
   g.mobilityUsed+=mobilityCost;g.lastBattle=null;
   if(to.owner===id){from.army-=count;to.army+=count;g.log.unshift(p.name+' moved '+count+' soldiers.');}
   else if(!to.owner){
    from.army-=count;to.owner=id;to.army=count;
    g.log.unshift(p.name+' occupied an unclaimed hex.');
   }else{
    const enemy=room.players.find(x=>x.id===to.owner);
    if(to.ward>0)to.ward--;if(from.attackStock>0)from.attackStock--;
    g.lastBattle={attacker:p.name,defender:enemy.name,rounds:battle.rounds,source:from.id,target:to.id,result:battle.defenders===0?'conquered':'held'};
    from.army-=(count-battle.attackers);
    if(battle.defenders===0&&battle.attackers>0){
     from.army-=battle.attackers;to.owner=id;to.army=battle.attackers;
     to.structures=to.structures.filter(x=>x!=='walls');to.ward=0;to.attackStock=0;
     to.building=to.structures.includes('settlement')?2:to.structures.includes('outpost')?1:0;
     g.log.unshift(p.name+' conquered '+enemy.name+"'s territory!");
    }else{
     to.army=battle.defenders;
     g.log.unshift(p.name+' attacked '+enemy.name+'; defenders held.');
    }
   }
  }else throw Error('Unknown action.');
  if(points(g,id)>=TARGET_POINTS){
   g.phase='finished';g.winner=id;g.log.unshift(p.name+' united the frontier!');
  }
 }
 g.log=g.log.slice(0,20);
}
const actionLabels={edgeWall:'built one wall',gate:'built one gate',offerTrade:'proposed a trade',tavernTrade:'traded at a tavern',roll:'rolled the dice',end:'ended their turn',deploy:'placed troops',confirmDeployment:'placed troops',allocate:'planned reinforcements',build:'built one structure',road:'built one road',bridge:'built one bridge',march:'moved troops',launch:'launched a boat',embark:'embarked troops',sail:'moved a fleet',bombard:'bombarded a garrison',land:'landed troops',dock:'built a dock'};
function discover(room){
 for(const p of room.players)room.game.discovered[p.id]=[...new Set([...(room.game.discovered[p.id]||[]),...visibility(room.game,p.id).visible])];
}
function publicEvent(event,id){
 const own=event.actor===id,seen=event.audience[id]||[];
 const from=own||seen.includes(event.from)?event.from:null,to=own||seen.includes(event.to)?event.to:null;
 const detailed=own||from||to;
 return {seq:event.seq,at:event.at,actor:event.actor,type:event.type,summary:event.summary,from,to,
  amount:detailed?event.amount:null,kind:detailed?event.kind:null};
}
export function perform(room,id,action){
 const g=room.game;
 if(['acceptTrade','rejectTrade'].includes(action?.type)){answerTrade(room,id,action);g.events.push({seq:++g.eventSeq,at:Date.now(),actor:id,type:action.type,summary:room.players.find(p=>p.id===id).name+(action.type==='acceptTrade'?' accepted a trade.':' declined a trade.'),audience:{}});g.events=g.events.slice(-50);return;}
 if(g?.phase!=='playing'||room.players[g.turn]?.id!==id)throw Error('Not your turn.');
 if(action?.type==='road'&&action.edge?.includes('|')){const [a,b]=action.edge.split('|').map(k=>g.tiles.find(t=>t.id===k));if(a&&b)action={...action,edge:borderBetween(a,b)};}
 const from=g?.tiles.find(t=>t.id===action?.from),to=g?.tiles.find(t=>t.id===action?.to);
 const previousOwner=to?.owner,siege=from&&to&&['march','land'].includes(action.type)&&wallOn(g,from,to)?.wall?.owner&&wallOn(g,from,to).wall.owner!==id;
 const moved=prepareMovement(g,{...action,road:from&&to&&(g.borders?.[borderBetween(from,to)]?.road===id||g.roads[edgeId(from.id,to.id)]===id)});
 const before=g?Object.fromEntries(room.players.map(p=>[p.id,[...visibility(g,p.id).visible]])):{};
 performAction(room,id,action);moved();
 if(['bombard','march','land'].includes(action.type)&&previousOwner&&previousOwner!==id)g.provoked[previousOwner]=id;
 discover(room);
 if(action.type==='allocate')return; // Draft allocations stay private until the player confirms.
 const actor=room.players.find(p=>p.id===id);
 const audience=Object.fromEntries(room.players.map(p=>[p.id,[...new Set([...(before[p.id]||[]),...visibility(g,p.id).visible])]]));
 const event={seq:++g.eventSeq,at:Date.now(),actor:id,type:action.type,summary:actor.name+' '+(actionLabels[action.type]||'issued orders')+'.',
  from:action.from||null,to:action.to||action.tile||null,amount:action.amount||action.count||null,kind:action.kind||null,audience};

 if(siege){event.type='siege';event.summary=actor.name+' attacked a wall.';}
 g.events.push(event);g.events=g.events.slice(-50);
}
export function visibility(g,id){
 const visible=new Set(),numbers=new Set(),tiles=g.tiles;
 const owned=tiles.filter(t=>t.owner===id&&(t.army>0||t.building||t.navy>0||t.boats>0));
 const borderRoads=Object.entries(g.borders||{}).filter(([,b])=>b.road===id).flatMap(([key])=>tiles.filter(t=>hexEdges(t).some(e=>e.key===key)));
 const ownedRoads=borderRoads.concat(Object.entries(g.roads).filter(([,owner])=>owner===id).map(([key])=>key.split('|')).flat().map(x=>tileAt(g,x)).filter(Boolean));
 for(const t of tiles){
  if(owned.some(source=>dist(source,t)<=1)||owned.some(source=>source.structures.length>1&&dist(source,t)<=2)||ownedRoads.some(source=>dist(source,t)<=2))visible.add(t.id);
  if(owned.some(source=>dist(source,t)<=5))numbers.add(t.id);
 }
 return {visible,numbers};
}
export function forPlayer(room,id){
 const g=room.game;
 const players=room.players.map(p=>({id:p.id,name:p.name,color:p.color,profile:p.profile,bot:p.bot,connected:p.connected,resources:p.id===id?p.resources:null}));
 if(!g)return {code:room.code,host:room.host,players,game:null};
 const view=visibility(g,id);
 const tiles=g.tiles.map(t=>{
  const isSeen=t.owner===id||view.visible.has(t.id);
  return {...t,tavern:!!t.tavern&&isSeen,tavernRates:t.tavern&&isSeen?Object.fromEntries(RESOURCES.map(r=>[r,tavernRate(g,t,r)])):null,moveReady:t.owner===id?{army:ready(g,t,'army',1),fastArmy:ready(g,t,'army',.5),navy:ready(g,t,'navy',.5)}:null,number:view.numbers.has(t.id)?t.number:null,numberHidden:t.number!==null&&!view.numbers.has(t.id),
   owner:isSeen?t.owner:null,army:isSeen?t.army:0,building:isSeen?t.building:0,structures:isSeen?[...t.structures]:[],ward:isSeen?t.ward:0,attackStock:isSeen?t.attackStock:0,
   navy:isSeen?t.navy:0,boats:isSeen?t.boats:0,visible:isSeen,discovered:(g.discovered[id]||[]).includes(t.id)||isSeen,condensed:isSeen,masked:!isSeen,bridge:isSeen?t.bridge:false};
 });
 const roads={};
 for(const [edge,owner] of Object.entries(g.roads)){
  const ids=edge.split('|');
  if(owner===id||ids.some(x=>view.visible.has(x)))roads[edge]=owner;
 }
 return {code:room.code,host:room.host,players,game:{...g,tiles,roads,borders:Object.fromEntries(Object.entries(g.borders||{}).filter(([key,b])=>b.road===id||b.wall?.owner===id||g.tiles.some(t=>view.visible.has(t.id)&&hexEdges(t).some(e=>e.key===key)))),movement:undefined,provoked:undefined,trade:g.trade&&(g.trade.from===id||g.trade.to===id)?g.trade:null,serverNow:Date.now(),discovered:g.discovered[id]||[...view.visible],allocations:{[id]:{...g.allocations[id]}},events:g.events.map(e=>publicEvent(e,id)),log:g.events.length?[...g.events].reverse().map(e=>e.summary):g.log,reinforcements:{[id]:g.reinforcements[id]||0},productionReserve:{[id]:g.productionReserve[id]||0},income:room.players[g.turn]?.id===id?g.income:null,scores:Object.fromEntries(room.players.map(x=>[x.id,points(g,x.id)])),
   lastBattle:g.lastBattle&&(g.lastBattle.attacker===players.find(p=>p.id===id)?.name||g.lastBattle.defender===players.find(p=>p.id===id)?.name)?g.lastBattle:null,
   spawnChoices:g.phase==='draft'?g.spawnChoices:[],draftOrder:g.phase==='draft'?g.draftOrder:[]}};
}
