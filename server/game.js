// RISKAGON — deterministic rules and server-authoritative action validation.
// 19 pointy-top hexes; settlements and armies occupy hex centers, roads occupy shared edges.
export const RESOURCES = ['wood', 'brick', 'wheat', 'sheep', 'ore'];
export const COLORS = ['blue', 'red', 'green', 'yellow'];
export const COSTS = {
  road: {wood: 1, brick: 1},
  settlement: {wood: 1, brick: 1, wheat: 1, sheep: 1},
  fort: {ore: 2, brick: 1, wheat: 1},
  recruit: {ore: 1, sheep: 1}
};
export const TARGET_POINTS = 13;
export const axialId = (q,r) => q + ',' + r;
export const neighbors = (a,b) => {
  const dq = a.q-b.q, dr = a.r-b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq+dr)) === 1;
};
export const edgeId = (a,b) => [a,b].sort().join('|');
const shuffle = a => {
  const arr = [...a];
  for (let i=arr.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
};
export function createGame(players) {
  const positions=[];
  for (let q=-2;q<=2;q++) for (let r=-2;r<=2;r++) {
    if (Math.abs(q+r)<=2) positions.push({q,r});
  }
  const terrains=shuffle(['forest','forest','forest','forest','fields','fields','fields','fields','pasture','pasture','pasture','pasture','hills','hills','hills','mountains','mountains','mountains','desert']);
  const numbers=shuffle([2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]);
  let n=0;
  const tiles=positions.map((p,i)=>({...p,id:axialId(p.q,p.r),terrain:terrains[i],number:terrains[i]==='desert'?null:numbers[n++],owner:null,army:0,building:0}));
  const spawns=[axialId(-2,0),axialId(2,0),axialId(0,-2),axialId(0,2)];
  players.forEach((p,i)=>{
    p.color=COLORS[i];
    p.resources=Object.fromEntries(RESOURCES.map(x=>[x,4]));
    const tile=tiles.find(t=>t.id===spawns[i]);
    tile.owner=p.id; tile.army=6; tile.building=1;
  });
  return {phase:'playing',tiles,roads:{},turn:0,round:1,rolled:false,mobilityUsed:0,lastRoll:null,lastBattle:null,log:['The frontier is open. Claim the hexes!'],winner:null};
}
export const getTile=(game,id)=>game.tiles.find(t=>t.id===id);
export const score=(game,id)=>game.tiles.filter(t=>t.owner===id).reduce((total,t)=>total+1+t.building,0);
export const edgeTiles=(game,key)=>{
  if (typeof key!=='string') return null;
  const ids=key.split('|');
  if (ids.length!==2) return null;
  const a=getTile(game,ids[0]), b=getTile(game,ids[1]);
  return a&&b&&neighbors(a,b)&&edgeId(a.id,b.id)===key?[a,b]:null;
};
const canPay=(p,cost)=>Object.entries(cost).every(([k,v])=>(p.resources[k]||0)>=v);
const pay=(p,cost)=>Object.entries(cost).forEach(([k,v])=>{p.resources[k]-=v;});
const rollDie=()=>1+Math.floor(Math.random()*6);
const dice=n=>Array.from({length:n},rollDie).sort((a,b)=>b-a);
function battle(attacker,defender,roadBonus,fortified) {
  let attacking=attacker, defending=defender;
  const rounds=[];
  while(attacking>0 && defending>0 && rounds.length<100){
    const ad=dice(Math.min(3,attacking));
    const dd=dice(Math.min(2,defending));
    if (roadBonus) ad[0]=Math.min(6,ad[0]+1);
    if (fortified) dd[0]=Math.min(6,dd[0]+1);
    let lostA=0,lostD=0;
    for(let i=0;i<Math.min(ad.length,dd.length);i++){
      if(ad[i]>dd[i]){defending--;lostD++;}else{attacking--;lostA++;}
    }
    rounds.push({attack:ad,defense:dd,lostA,lostD});
  }
  return {attacking,defending,rounds};
}
export function applyAction(room, playerId, action) {
  const g=room.game;
  if(!g || g.phase!=='playing') throw Error('Game has not started or is finished.');
  const index=room.players.findIndex(p=>p.id===playerId);
  if(index<0 || g.turn!==index) throw Error('It is not your turn.');
  const p=room.players[index];
  if(!action || typeof action.type!=='string') throw Error('Invalid action.');
  const type=action.type;
  if(type==='roll'){
    if(g.rolled) throw Error('You already rolled.');
    const result=rollDie()+rollDie();
    g.rolled=true;g.lastRoll=result;
    const terrainResource={forest:'wood',hills:'brick',fields:'wheat',pasture:'sheep',mountains:'ore'};
    for(const tile of g.tiles){
      if(tile.number!==result || !tile.owner) continue;
      const resource=terrainResource[tile.terrain];
      const owner=room.players.find(x=>x.id===tile.owner);
      if(resource&&owner) owner.resources[resource]+=(1+tile.building);
    }
    g.log.unshift(p.name+' rolled '+result+'. All matching territories produced resources.');
  } else if(type==='end'){
    if(!g.rolled) throw Error('Roll before ending the turn.');
    g.turn=(g.turn+1)%room.players.length;
    if(g.turn===0) g.round++;
    g.rolled=false;g.mobilityUsed=0;g.lastRoll=null;g.lastBattle=null;
    g.log.unshift('Round '+g.round+': '+room.players[g.turn].name+' is up.');
  } else {
    if(!g.rolled) throw Error('Roll the dice first.');
    if(type==='road'){
      const pair=edgeTiles(g,action.edge);
      if(!pair) throw Error('Choose a valid shared hex edge.');
      if(g.roads[action.edge]) throw Error('A road already occupies that edge.');
      if(!pair.some(t=>t.owner===p.id)) throw Error('Your road must touch one of your territories.');
      if(!canPay(p,COSTS.road)) throw Error('Need wood and brick.');
      pay(p,COSTS.road);g.roads[action.edge]=p.id;
      g.log.unshift(p.name+' laid a trade road.');
    } else if(type==='settlement'||type==='fort'||type==='recruit'){
      const tile=getTile(g,action.tile);
      if(!tile||tile.owner!==p.id) throw Error('Select one of your territories.');
      if(type==='settlement'){
        if(tile.building) throw Error('There is already a settlement here.');
        if(!canPay(p,COSTS.settlement)) throw Error('Not enough resources for a settlement.');
        pay(p,COSTS.settlement);tile.building=1;
        g.log.unshift(p.name+' founded a settlement.');
      } else if(type==='fort'){
        if(tile.building!==1) throw Error('Upgrade a settlement to a fortress first.');
        if(!canPay(p,COSTS.fort)) throw Error('Not enough resources for a fortress.');
        pay(p,COSTS.fort);tile.building=2;
        g.log.unshift(p.name+' raised a fortress.');
      } else {
        if(!tile.building) throw Error('Recruit at a settlement or fortress.');
        if(!canPay(p,COSTS.recruit)) throw Error('Need ore and sheep to recruit.');
        pay(p,COSTS.recruit);tile.army+=2;
        g.log.unshift(p.name+' recruited two soldiers.');
      }
    } else if(type==='march'){
      const from=getTile(g,action.from),to=getTile(g,action.to),amount=action.amount;
      if(!from||!to||!neighbors(from,to)) throw Error('March only between neighboring hexes.');
      if(from.owner!==p.id) throw Error('Start from your own territory.');
      if(!Number.isSafeInteger(amount)||amount<1||amount>=from.army) throw Error('Leave at least one troop behind.');
      const key=edgeId(from.id,to.id);
      const roadOwned=g.roads[key]===p.id;
      const moveCost=roadOwned?0.5:1;
      if(g.mobilityUsed+moveCost>2) throw Error('Movement limit reached (2 points per turn).');
      g.mobilityUsed+=moveCost;
      g.lastBattle=null;
      if(to.owner===p.id){
        from.army-=amount;to.army+=amount;
        g.log.unshift(p.name+' moved '+amount+' troops.');
      } else if(!to.owner){
        from.army-=amount;to.army=amount;to.owner=p.id;
        g.log.unshift(p.name+' claimed '+to.terrain+' territory.');
      } else {
        const defender=room.players.find(x=>x.id===to.owner);
        const defenderName=defender?.name||'Opponent';
        const result=battle(amount,to.army,roadOwned,to.building===2);
        g.lastBattle={from:p.name,defender:defenderName,committed:amount,remaining:result.attacking,defenders:result.defending,rounds:result.rounds};
        from.army-=(amount-result.attacking);
        if(result.defending===0&&result.attacking>0){
          from.army-=result.attacking;
          to.owner=p.id;to.army=result.attacking;
          to.building=Math.max(0,to.building-1);
          g.log.unshift(p.name+' conquered '+defenderName+"'s "+to.terrain+'!');
        } else {
          to.army=result.defending;
          g.log.unshift(p.name+' attacked '+defenderName+' but the defenders held.');
        }
      }
    } else throw Error('Unknown action.');
    if(score(g,p.id)>=TARGET_POINTS) {
      g.phase='finished';g.winner=p.id;
      g.log.unshift(p.name+' united the realm and won Riskagon!');
    }
  }
  g.log=g.log.slice(0,12);
}
export function publicRoom(room) {
  return {code:room.code,host:room.host,players:room.players.map(({id,name,color,resources,connected,bot})=>({id,name,color,resources,connected,bot})),game:room.game};
}
