
import test from 'node:test';
import assert from 'node:assert/strict';
import {newRealm,chooseDraft,currentDrafter,perform,visibility,forPlayer,dist,edgeId,adjacent,points,COSTS,RESOURCE_TERRAIN,RADIUS} from './realm.js';
function start(n=2){
 const players=Array.from({length:n},(_,i)=>({id:'human'+i,name:'Human '+i,color:null,resources:{}}));
 const room={code:'DEMO42',host:players[0].id,players,game:newRealm(players)};
 const colors=['blue','red','green','yellow'];
 for(let i=0;i<n;i++)chooseDraft(room,currentDrafter(room),'color',colors[i]);
 const spawns=['-5,0','5,0','0,-5','0,5'];
 for(let i=0;i<n;i++)chooseDraft(room,currentDrafter(room),'spawn',spawns[i]);
 return room;
}
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
 perform(room,p.id,{type:'roll'});
 assert.throws(()=>perform(room,p.id,{type:'deploy',tile:home.id,count:1}),/Not enough reinforcements/);
 assert.throws(()=>perform(room,p.id,{type:'build',tile:home.id,kind:'barracks'}),/Not enough resources/);
 perform(room,p.id,{type:'end'});
 perform(room,room.players[1].id,{type:'roll'});
 perform(room,room.players[1].id,{type:'end'});
 assert.equal(g.round,2);
 assert.equal(g.reinforcements[p.id],2);
 perform(room,p.id,{type:'roll'});
 perform(room,p.id,{type:'deploy',tile:home.id,count:2});
 assert.equal(home.army,5);
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
 perform(room,p.id,{type:'roll'});
 const edge=edgeId(home.id,neighbor.id);
 const ownedBefore=Object.keys(g.roads).length;
 perform(room,p.id,{type:'road',edge});
 assert.equal(Object.keys(g.roads).length,ownedBefore+1);
 assert.equal(g.roads[edge],p.id);
 assert.throws(()=>perform(room,p.id,{type:'road',edge}),/already has a road/);
 const visible=visibility(g,p.id);
 assert.ok(visible.visible.has(neighbor.id));
});
test('a compatible industry must match resource terrain; houses and walls coexist',()=>{
 const room=start(),g=room.game,p=room.players[0],home=g.tiles.find(t=>t.owner===p.id);
 for(const key of Object.keys(COSTS.homes))p.resources[key]=20;
 p.resources.ore=20;
 perform(room,p.id,{type:'roll'});
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
 perform(room,p.id,{type:'roll'});
 assert.throws(()=>perform(room,p.id,{type:'march',from:adjacentTile.id,to:river.id,amount:2}),/bridge/);
 perform(room,p.id,{type:'bridge',tile:river.id});
 perform(room,p.id,{type:'march',from:adjacentTile.id,to:river.id,amount:2});
 assert.equal(river.owner,p.id);
 assert.equal(river.army,2);
});
