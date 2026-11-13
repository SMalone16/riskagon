
import {randomInt} from 'node:crypto';
import {rollPhysics} from './dicePhysics.js';
export const COLORS=['blue','red','green','yellow'];
export const RESOURCES=['wood','brick','wheat','sheep','ore'];
export const RADIUS=5;
export const TARGET_POINTS=32;
export const COSTS={
 road:{wood:1,brick:1},outpost:{wood:1,brick:1},
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
  cells.push({q,r,id:axialId(q,r),terrain:null,number:null,owner:null,army:0,building:0,structures:[],ward:0,attackStock:0,bridge:false,navy:0});
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
 return cells;
}
const choices=()=>['-5,0','5,0','0,-5','0,5','-5,5','5,-5','-3,-2','3,2'];
export function newRealm(players){
 return {phase:'draft',draftStage:'color',draftOrder:players.map(p=>p.id),draftIndex:0,spawnChoices:choices(),tiles:generateMap(),roads:{},turn:0,round:1,rolled:false,lastRoll:null,lastBattle:null,mobilityUsed:0,reinforcements:{},pendingDice:null,winner:null,log:['Color draft is open. Choose a banner.']};
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
  tile.owner=id;tile.army=3;tile.building=1;tile.structures=['outpost'];
  p.resources={wood:1,brick:1,wheat:1,sheep:1,ore:0};
  g.spawnChoices=g.spawnChoices.filter(x=>x!==value);
  g.log.unshift(p.name+' claimed a starting outpost.');
 }
 g.draftIndex++;
 if(g.draftStage==='color'&&g.draftIndex>=room.players.length){
  g.draftStage='spawn';g.draftIndex=0;
  g.log.unshift('Starting location draft is open, in reverse order.');
 }else if(g.draftStage==='spawn'&&g.draftIndex>=room.players.length){
  g.phase='playing';g.turn=0;g.round=1;g.rolled=false;
  g.mobilityUsed=0;g.log.unshift('The frontier opens. Every kingdom starts with 3 troops.');
  for(const x of room.players)g.reinforcements[x.id]=0;
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
export function perform(room,id,action){
 const g=room.game,p=room.players.find(x=>x.id===id);
 if(g?.phase!=='playing')throw Error('The match is not currently playing.');
 if(!p||room.players[g.turn].id!==id)throw Error('Not your turn.');
 const t=action?.type;
 if(t==='roll'){
  if(g.rolled)throw Error('Already rolled this turn.');
  // Server physically simulates the throw and reads the two uppermost faces.
  const d=rollPhysics(2,action.throw),sum=d[0]+d[1];
  g.rolled=true;g.lastRoll={dice:d,sum};
  for(const tile of g.tiles){
   if(tile.number!==sum||!tile.owner)continue;
   const owner=room.players.find(x=>x.id===tile.owner);
   const resource=RESOURCE_TERRAIN[tile.terrain];
   if(resource){
    let count=1+(tile.structures.includes('homes')?1:0);
    if(tile.structures.includes(RESOURCE_STRUCTURE[tile.terrain]))count+=2;
    owner.resources[resource]=(owner.resources[resource]||0)+count;
   }
   if(tile.structures.includes('walls'))tile.ward=Math.min(3,tile.ward+1);
   if(tile.structures.includes('armory'))tile.attackStock=Math.min(3,tile.attackStock+1);
   if(tile.structures.includes('barracks'))tile.army+=2;
   if(tile.structures.includes('stables'))owner.storedMobility=Math.min(2,(owner.storedMobility||0)+1);
  }
  g.log.unshift(p.name+' rolled '+d.join(' + ')+' = '+sum+'. Provinces produced.');
 }else if(t==='end'){
  if(!g.rolled)throw Error('Roll the dice before ending your turn.');
  g.turn=(g.turn+1)%room.players.length;if(g.turn===0)g.round++;
  g.rolled=false;g.lastRoll=null;g.lastBattle=null;
  g.mobilityUsed=0;
  const next=room.players[g.turn];
  g.mobilityCap=2+Math.min(2,next.storedMobility||0);
  next.storedMobility=0;
  // No free reinforcements at all until everyone has played once.
  g.reinforcements[next.id]=g.round>1?2:0;
  g.log.unshift('Round '+g.round+': '+next.name+' prepares their orders.');
 }else{
  if(!g.rolled)throw Error('Roll your physical dice before taking actions.');
  if(t==='road'){
   const pieces=String(action.edge||'').split('|');
   if(pieces.length!==2||edgeId(...pieces)!==action.edge)throw Error('Invalid road edge.');
   const a=tileAt(g,pieces[0]),b=tileAt(g,pieces[1]);
   if(!a||!b||!adjacent(a,b))throw Error('Roads must follow a shared hex edge.');
   if(g.roads[action.edge])throw Error('This edge already has a road.');
   if(![a,b].some(x=>x.owner===id))throw Error('Build a road from your own territory.');
   if(['lake','river'].includes(a.terrain)||['lake','river'].includes(b.terrain))throw Error('Water crossings require bridges (or future naval docks).');
   pay(p,COSTS.road);g.roads[action.edge]=id;g.log.unshift(p.name+' laid a border road.');
  }else if(t==='bridge'){
   const tile=tileAt(g,action.tile);
   if(!tile||tile.terrain!=='river'||tile.bridge)throw Error('Choose an unbridged river hex.');
   if(!g.tiles.some(x=>x.owner===id&&adjacent(x,tile)))throw Error('Bridge must connect to owned land.');
   pay(p,COSTS.bridge);tile.bridge=id;
   g.log.unshift(p.name+' built a bridge across the river.');
  }else if(t==='build'){
   const tile=tileAt(g,action.tile),kind=action.kind;
   if(!tile||tile.owner!==id)throw Error('Build on your territory.');
   if(!COSTS[kind]||['road','bridge'].includes(kind))throw Error('Unknown structure.');
   if(tile.structures.includes(kind))throw Error('Structure is already built.');
   if(kind==='outpost'){
    if(tile.building)throw Error('Outpost already exists.');
   }else{
    if(!tile.building)throw Error('Build an outpost first.');
    if(tile.structures.length>=5)throw Error('This settlement has reached its five-building limit.');
    if(['farm','lumberyard','quarry','mine','ranch'].includes(kind)&&RESOURCE_STRUCTURE[tile.terrain]!==kind)throw Error('This industry does not match the terrain.');
   }
   pay(p,COSTS[kind]);tile.structures.push(kind);
   if(kind==='outpost')tile.building=1;
   g.log.unshift(p.name+' constructed '+kind+' in '+tile.terrain+'.');
  }else if(t==='deploy'){
   const tile=tileAt(g,action.tile),count=action.count;
   if(!tile||tile.owner!==id||!tile.building)throw Error('Deploy from an owned outpost or settlement.');
   if(!Number.isSafeInteger(count)||count<1||(g.reinforcements[id]||0)<count)throw Error('Not enough reinforcements remaining.');
   tile.army+=count;g.reinforcements[id]-=count;
   g.log.unshift(p.name+' deployed '+count+' free reinforcements.');
  }else if(t==='march'){
   const from=tileAt(g,action.from),to=tileAt(g,action.to),count=action.amount;
   if(!from||!to||!adjacent(from,to))throw Error('March to an adjacent hex.');
   if(from.owner!==id)throw Error('March from your own territory.');
   if(!Number.isSafeInteger(count)||count<1||count>=from.army)throw Error('Keep at least one soldier at home.');
   if(to.terrain==='lake')throw Error('A lake requires a future shipyard and naval transport.');
   if(to.terrain==='river'&&to.bridge!==id)throw Error('Construct a bridge before crossing this river.');
   const road=g.roads[edgeId(from.id,to.id)]===id;
   const mobilityCost=road?0.5:1;
   if(g.mobilityUsed+mobilityCost>(g.mobilityCap||2))throw Error('No movement points left.');
   g.mobilityUsed+=mobilityCost;g.lastBattle=null;
   if(to.owner===id){from.army-=count;to.army+=count;g.log.unshift(p.name+' moved '+count+' soldiers.');}
   else if(!to.owner){
    from.army-=count;to.owner=id;to.army=count;
    g.log.unshift(p.name+' occupied an unclaimed hex.');
   }else{
    const enemy=room.players.find(x=>x.id===to.owner);
    const defBonus=(to.structures.includes('walls')?1:0)+(to.ward>0?1:0);
    const attackBonus=(road?1:0)+(from.attackStock>0?1:0);
    if(to.ward>0)to.ward--;if(from.attackStock>0)from.attackStock--;
    const battle=diceBattle(count,to.army,attackBonus,defBonus);
    g.lastBattle={attacker:p.name,defender:enemy.name,rounds:battle.rounds,source:from.id,target:to.id,result:battle.defenders===0?'conquered':'held'};
    from.army-=(count-battle.attackers);
    if(battle.defenders===0&&battle.attackers>0){
     from.army-=battle.attackers;to.owner=id;to.army=battle.attackers;
     to.structures=to.structures.filter(x=>x!=='walls');to.ward=0;to.attackStock=0;
     to.building=to.structures.includes('outpost')?1:0;
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
export function visibility(g,id){
 const visible=new Set(),numbers=new Set(),tiles=g.tiles;
 const owned=tiles.filter(t=>t.owner===id&&(t.army>0||t.building));
 const ownedRoads=Object.entries(g.roads).filter(([,owner])=>owner===id).map(([key])=>key.split('|')).flat().map(x=>tileAt(g,x)).filter(Boolean);
 for(const t of tiles){
  if(owned.some(source=>dist(source,t)<=1)||owned.some(source=>source.structures.length>1&&dist(source,t)<=2)||ownedRoads.some(source=>dist(source,t)<=2))visible.add(t.id);
  if(owned.some(source=>dist(source,t)<=5))numbers.add(t.id);
 }
 return {visible,numbers};
}
export function forPlayer(room,id){
 const g=room.game;
 const players=room.players.map(p=>({id:p.id,name:p.name,color:p.color,bot:p.bot,connected:p.connected,resources:p.id===id?p.resources:null}));
 if(!g)return {code:room.code,host:room.host,players,game:null};
 const view=visibility(g,id);
 const tiles=g.tiles.map(t=>{
  const isSeen=t.owner===id||view.visible.has(t.id);
  return {...t,number:view.numbers.has(t.id)?t.number:null,numberHidden:t.number!==null&&!view.numbers.has(t.id),
   owner:isSeen?t.owner:null,army:isSeen?t.army:0,building:isSeen?t.building:0,structures:isSeen?[...t.structures]:[],ward:isSeen?t.ward:0,attackStock:isSeen?t.attackStock:0,
   condensed:isSeen,masked:!isSeen,bridge:isSeen?t.bridge:false};
 });
 const roads={};
 for(const [edge,owner] of Object.entries(g.roads)){
  const ids=edge.split('|');
  if(owner===id||ids.some(x=>view.visible.has(x)))roads[edge]=owner;
 }
 return {code:room.code,host:room.host,players,game:{...g,tiles,roads,scores:Object.fromEntries(room.players.map(x=>[x.id,points(g,x.id)])),
   lastBattle:g.lastBattle&&(g.lastBattle.attacker===players.find(p=>p.id===id)?.name||g.lastBattle.defender===players.find(p=>p.id===id)?.name)?g.lastBattle:null,
   spawnChoices:g.phase==='draft'?g.spawnChoices:[],draftOrder:g.phase==='draft'?g.draftOrder:[]}};
}
