
import {borderBetween} from '../shared/edges.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newRealm,chooseDraft,currentDrafter,perform,finishRoll,reinforcementIncome,troopOutput,visibility,forPlayer,dist,edgeId,adjacent,points,COSTS,RESOURCE_TERRAIN,RADIUS} from './realm.js';
function start(n=2){
 const players=Array.from({length:n},(_,i)=>({id:'human'+i,name:'Human '+i,color:null,resources:{}}));
 const room={code:'DEMO42',host:players[0].id,players,game:newRealm(players)};
 const colors=['blue','red','green','yellow'];
 for(let i=0;i<n;i++)chooseDraft(room,currentDrafter(room),'color',colors[i]);
 const spawns=['-5,0','5,0','0,-5','0,5'];
 for(let i=0;i<n;i++)chooseDraft(room,currentDrafter(room),'spawn',spawns[i]);
 return room;
}
function roll(room,id){perform(room,id,{type:'roll'});finishRoll(room,room.game.lastRoll.readyAt);}
test('radius-five map has 91 distinct hexes and water obstacles',()=>{
 const room=start(),g=room.game;
 assert.equal(g.tiles.length,91);
 assert.equal(new Set(g.tiles.map(x=>x.id)).size,91);
 assert.ok(g.tiles.every(x=>dist(x,{q:0,r:0})<=RADIUS));
 assert.ok(g.tiles.filter(x=>x.terrain==='lake').length>=4);
 assert.ok(g.tiles.filter(x=>x.terrain==='river').length>=3);
 assert.ok(g.tiles.filter(x=>RESOURCE_TERRAIN[x.terrain]).every(x=>x.number>=2&&x.number<=12));
});
test('draft colors and starting locations are exclusive, reverse order',()=>{
 const players=[{id:'one',name:'One'},{id:'two',name:'Two'}],room={players,game:newRealm(players)};
 assert.equal(currentDrafter(room),'one');
 chooseDraft(room,'one','color','red');
 assert.throws(()=>chooseDraft(room,'one','color','green'),/Wait/);
 assert.throws(()=>chooseDraft(room,'two','color','red'),/available/);
 chooseDraft(room,'two','color','blue');
 assert.equal(room.game.draftStage,'spawn');
 assert.equal(currentDrafter(room),'two');
 chooseDraft(room,'two','spawn','5,0');
 assert.equal(currentDrafter(room),'one');
 chooseDraft(room,'one','spawn','-5,0');
 assert.equal(room.game.phase,'playing');
 assert.equal(room.game.tiles.filter(x=>x.owner).length,2);
});
test('first round starts with only three soldiers and no free reinforcement',()=>{
 const room=start(),g=room.game,p=room.players[0];
 const home=g.tiles.find(t=>t.owner===p.id);
 assert.equal(home.army,3);
 assert.equal(g.reinforcements[p.id],0);
 assert.throws(()=>perform(room,p.id,{type:'deploy',tile:home.id,count:1}),/Roll/);
 roll(room,p.id);
 assert.throws(()=>perform(room,p.id,{type:'deploy',tile:home.id,count:1}),/Not enough reinforcements/);
 assert.throws(()=>perform(room,p.id,{type:'build',tile:home.id,kind:'barracks'}),/Not enough resources/);
 perform(room,p.id,{type:'end'});
 roll(room,room.players[1].id);
 perform(room,room.players[1].id,{type:'end'});
 assert.equal(g.round,2);
 assert.equal(g.reinforcements[p.id],0);
 roll(room,p.id);
 const income=g.reinforcements[p.id];
 assert.ok(income>=2);
 perform(room,p.id,{type:'deploy',tile:home.id,count:income});
 assert.equal(home.army,3+income);
 assert.equal(g.reinforcements[p.id],0);
});
test('per-player fog shows local units but never faraway enemy ownership or dice numbers',()=>{
 const room=start(),g=room.game,p=room.players[0];
 const own=g.tiles.find(t=>t.owner===p.id),enemy=g.tiles.find(t=>t.owner!==p.id&&t.owner);
 const view=forPlayer(room,p.id),seen=view.game.tiles.find(t=>t.id===own.id),hidden=view.game.tiles.find(t=>t.id===enemy.id);
 assert.equal(seen.army,3);assert.equal(seen.owner,p.id);assert.equal(seen.condensed,true);
 assert.equal(hidden.owner,null);assert.equal(hidden.army,0);assert.equal(hidden.masked,true);
 assert.ok(view.game.tiles.filter(t=>dist(t,own)>5 && t.numberHidden).length>0);
 assert.equal(view.players.find(x=>x.id!==p.id).resources,null);
});
test('road must follow a legal shared land border and exposes farther territory',()=>{
 const room=start(),g=room.game,p=room.players[0],home=g.tiles.find(t=>t.owner===p.id);
 const neighbor=g.tiles.find(t=>!t.owner&&adjacent(t,home)&&RESOURCE_TERRAIN[t.terrain]);
 assert.ok(neighbor);
 roll(room,p.id);
 neighbor.owner=p.id;neighbor.army=1;
 const edge=edgeId(home.id,neighbor.id);
 const ownedBefore=Object.keys(g.borders).length;
 perform(room,p.id,{type:'road',edge});
 assert.equal(Object.keys(g.borders).length,ownedBefore+1);
 assert.equal(g.borders[borderBetween(home,neighbor)].road,p.id);
 assert.throws(()=>perform(room,p.id,{type:'road',edge}),/already exists/);
 const visible=visibility(g,p.id);
 assert.ok(visible.visible.has(neighbor.id));
});
test('a compatible industry must match resource terrain; houses and walls coexist',()=>{
 const room=start(),g=room.game,p=room.players[0],home=g.tiles.find(t=>t.owner===p.id);
 for(const key of Object.keys(COSTS.homes))p.resources[key]=20;
 p.resources.ore=20;
 roll(room,p.id);
 perform(room,p.id,{type:'build',tile:home.id,kind:'homes'});
 perform(room,p.id,{type:'build',tile:home.id,kind:'walls'});
 assert.ok(home.structures.includes('homes'));
 assert.ok(home.structures.includes('walls'));
 const wrong={forest:'mine',fields:'quarry',pasture:'farm',mountains:'ranch',hills:'farm'}[home.terrain];
 assert.throws(()=>perform(room,p.id,{type:'build',tile:home.id,kind:wrong}),/does not match/);
});
test('river blocks marching until bridge is constructed',()=>{
 const room=start(),g=room.game,p=room.players[0],home=g.tiles.find(t=>t.owner===p.id);
 const river=g.tiles.find(t=>t.terrain==='river');
 home.owner=null;home.army=0;home.building=0;home.structures=[];
 const adjacentTile=g.tiles.find(t=>t.owner===null&&adjacent(t,river)&&t.terrain!=='river'&&t.terrain!=='lake');
 assert.ok(adjacentTile);
 adjacentTile.owner=p.id;adjacentTile.army=5;adjacentTile.building=1;adjacentTile.structures=['outpost'];
 p.resources={wood:20,brick:20,wheat:20,sheep:20,ore:20};
 roll(room,p.id);
 assert.throws(()=>perform(room,p.id,{type:'march',from:adjacentTile.id,to:river.id,amount:2}),/bridge/);
 perform(room,p.id,{type:'bridge',tile:river.id});
 perform(room,p.id,{type:'march',from:adjacentTile.id,to:river.id,amount:2});
 assert.equal(river.owner,p.id);
 assert.equal(river.army,2);
});

test('income counts resource pairs separately, excludes unoccupied tiles and replaces outpost base on upgrade',()=>{
 const room=start(),g=room.game,p=room.players[0];g.round=2;
 g.tiles.forEach(t=>{t.owner=null;t.army=0;t.building=0;t.structures=[];});
 const assign=(index,terrain,army,building=0,structures=[])=>Object.assign(g.tiles[index],{owner:p.id,terrain,army,building,structures,number:8});
 assign(0,'forest',1,1,['outpost']);assign(1,'forest',2);assign(2,'forest',3);
 assign(3,'hills',1,2,['outpost','settlement','barracks']);assign(4,'hills',1);assign(5,'hills',0);
 assign(6,'fields',1);assign(7,'lake',2);assign(8,'forest',0);
 const income=reinforcementIncome(g,p.id,8);
 assert.deepEqual(income.pairs,{wood:1,brick:1,wheat:0,sheep:0,ore:0});
 assert.equal(troopOutput(g.tiles[3]),6);assert.equal(income.structures,8);assert.equal(income.production,8);assert.equal(income.total,18);
 assert.equal(reinforcementIncome(g,p.id,5).total,10);
 g.round=1;assert.equal(reinforcementIncome(g,p.id,8).total,0);
});
test('rolling locks every action and production resolves exactly once after the final frame',()=>{
 const room=start(),g=room.game,p=room.players[0];g.round=2;
 perform(room,p.id,{type:'roll'});
 assert.equal(g.turnStage,'rolling');
 for(const type of ['deploy','road','march','build','end','roll'])assert.throws(()=>perform(room,p.id,{type}),/settle|rolling|Already|Finish/);
 assert.equal(finishRoll(room,g.lastRoll.readyAt-1),false);
 const home=g.tiles.find(t=>t.owner===p.id);
 home.number=g.lastRoll.sum;home.building=2;home.structures=['outpost','settlement','barracks'];
 const enemy=g.tiles.find(t=>t.owner&&t.owner!==p.id),enemyArmy=enemy.army;
 enemy.number=g.lastRoll.sum;enemy.structures.push('barracks');
 assert.equal(finishRoll(room,g.lastRoll.readyAt),true);
 assert.equal(home.army,3);assert.equal(enemy.army,enemyArmy);
 assert.equal(g.productionReserve[enemy.owner],5);
 assert.equal(g.income.production,6);assert.equal(g.reinforcements[p.id],12);assert.equal(g.turnStage,'deploy');
 assert.equal(finishRoll(room,Infinity),false);assert.equal(g.reinforcements[p.id],12);
 const view=forPlayer(room,room.players[1].id);
 assert.equal(view.game.income,null);assert.equal(view.game.productionReserve[p.id],undefined);assert.equal(view.game.reinforcements[p.id],undefined);
});
test('deployment can be split on occupied land and all orders stay locked until reserve is empty',()=>{
 const room=start(),g=room.game,p=room.players[0];g.round=2;
 const home=g.tiles.find(t=>t.owner===p.id),land=g.tiles.find(t=>!t.owner&&RESOURCE_TERRAIN[t.terrain]);
 land.owner=p.id;land.army=1;land.building=1;land.structures=['outpost'];
 roll(room,p.id);
 const reserve=g.reinforcements[p.id];assert.ok(reserve>=2);
 for(const type of ['road','bridge','build','march','end'])assert.throws(()=>perform(room,p.id,{type}),/reinforcements/);
 for(const count of [0,-1,1.5,NaN,Infinity,reserve+1])assert.throws(()=>perform(room,p.id,{type:'deploy',tile:home.id,count}),/reinforcements/);
 perform(room,p.id,{type:'deploy',tile:land.id,count:1});assert.equal(land.army,2);assert.equal(g.turnStage,'deploy');
 perform(room,p.id,{type:'deploy',tile:home.id,count:reserve-1});assert.equal(g.turnStage,'orders');
 assert.throws(()=>perform(room,p.id,{type:'deploy',tile:home.id,count:1}),/deployment/);
 perform(room,p.id,{type:'end'});assert.equal(g.turnStage,'roll');
});
test('settlement upgrades cost resources, produce six with barracks',()=>{
 const room=start(),g=room.game,p=room.players[0],home=g.tiles.find(t=>t.owner===p.id);
 p.resources={wood:30,brick:30,wheat:30,sheep:30,ore:30};roll(room,p.id);
 const wood=p.resources.wood;
 perform(room,p.id,{type:'build',tile:home.id,kind:'settlement'});
 assert.equal(home.building,2);assert.equal(p.resources.wood,wood-COSTS.settlement.wood);
 perform(room,p.id,{type:'build',tile:home.id,kind:'barracks'});assert.equal(troopOutput(home),6);
 assert.throws(()=>perform(room,p.id,{type:'build',tile:home.id,kind:'settlement'}),/already/);
});

test('matching troop production banks for rivals and joins their next start-of-turn reserve once',()=>{
 const room=start(),g=room.game,p=room.players[0],other=room.players[1];g.round=2;
 const home=g.tiles.find(t=>t.owner===p.id),enemy=g.tiles.find(t=>t.owner===other.id);
 home.number=2;enemy.number=8;enemy.building=2;enemy.structures=['outpost','settlement','barracks'];
 g.turnStage='rolling';g.rolled=true;g.lastRoll={sum:8,dice:[4,4],readyAt:1};
 finishRoll(room,1);assert.equal(g.productionReserve[other.id],6);assert.equal(enemy.army,3);
 perform(room,p.id,{type:'deploy',tile:home.id,count:g.reinforcements[p.id]});perform(room,p.id,{type:'end'});
 assert.equal(g.productionReserve[other.id],6);
 g.turnStage='rolling';g.rolled=true;g.lastRoll={sum:5,dice:[2,3],readyAt:2};
 finishRoll(room,2);assert.equal(g.income.production,6);assert.equal(g.reinforcements[other.id],12);
 assert.equal(g.productionReserve[other.id],0);assert.equal(enemy.army,3);
});

test('capturing a settlement retains its production upgrades and removes its walls',()=>{
 const room=start(),g=room.game,p=room.players[0],enemy=room.players[1],home=g.tiles.find(t=>t.owner===p.id);
 const target=g.tiles.find(t=>adjacent(t,home)&&RESOURCE_TERRAIN[t.terrain]);
 Object.assign(target,{owner:enemy.id,army:0,building:2,structures:['outpost','settlement','walls','barracks'],ward:2});
 roll(room,p.id);
 perform(room,p.id,{type:'march',from:home.id,to:target.id,amount:1});
 assert.equal(target.owner,p.id);assert.equal(target.building,2);assert.equal(troopOutput(target),6);
 assert.equal(target.structures.includes('walls'),false);assert.equal(target.ward,0);
 assert.equal(target.army,1);assert.equal(home.army,2);
});
