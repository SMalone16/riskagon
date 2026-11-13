import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,edgeId,edgeTiles,neighbors,score} from './game.js';
const setup=()=>{
 const players=['One','Two'].map((name,i)=>({id:'player'+i,name}));
 const room={players,game:createGame(players)};
 return room;
};
test('19 unique hex tiles, correct terrain and spawn inventory',()=>{
 const r=setup(),tiles=r.game.tiles;
 assert.equal(tiles.length,19);
 assert.equal(new Set(tiles.map(t=>t.id)).size,19);
 assert.equal(tiles.filter(t=>t.terrain==='desert').length,1);
 assert.equal(tiles.filter(t=>t.number===null).length,1);
 assert.equal(tiles.filter(t=>t.owner).length,2);
 assert.equal(r.players[0].resources.wood,4);
});
test('actions require roll and ownership',()=>{
 const r=setup(),id=r.players[0].id;
 assert.throws(()=>applyAction(r,id,{type:'recruit',tile:'0,0'}),/Roll/);
 assert.throws(()=>applyAction(r,'player1',{type:'roll'}),/not your turn/);
 applyAction(r,id,{type:'roll'});
 assert.throws(()=>applyAction(r,id,{type:'settlement',tile:'2,0'}),/your territories/);
});
test('settlement and recruitment validate resources',()=>{
 const r=setup(),p=r.players[0],tile=r.game.tiles.find(t=>t.owner===p.id);
 applyAction(r,p.id,{type:'roll'});
 const n=tile.army,ore=p.resources.ore,sheep=p.resources.sheep;
 applyAction(r,p.id,{type:'recruit',tile:tile.id});
 assert.equal(tile.army,n+2);
 assert.equal(p.resources.ore,ore-1);
 assert.equal(p.resources.sheep,sheep-1);
});
test('march captures neutral, road uses canonical shared edge',()=>{
 const r=setup(),p=r.players[0],from=r.game.tiles.find(t=>t.owner===p.id),to=r.game.tiles.find(t=>!t.owner&&neighbors(t,from));
 applyAction(r,p.id,{type:'roll'});
 const key=edgeId(from.id,to.id);
 assert.deepEqual(edgeTiles(r.game,key).map(t=>t.id).sort(),[from.id,to.id].sort());
 applyAction(r,p.id,{type:'road',edge:key});
 assert.equal(r.game.roads[key],p.id);
 applyAction(r,p.id,{type:'march',from:from.id,to:to.id,amount:3});
 assert.equal(to.owner,p.id);assert.equal(to.army,3);assert.equal(from.army,3);
 assert.equal(r.game.mobilityUsed,0.5);
 assert.ok(score(r.game,p.id)>=3);
});
test('cannot teleport, overspend, or move all troops',()=>{
 const r=setup(),p=r.players[0],from=r.game.tiles.find(t=>t.owner===p.id);
 applyAction(r,p.id,{type:'roll'});
 assert.throws(()=>applyAction(r,p.id,{type:'march',from:from.id,to:'2,0',amount:1}),/neighboring/);
 assert.throws(()=>applyAction(r,p.id,{type:'march',from:from.id,to:'-1,0',amount:100}),/Leave at least/);
 p.resources.wood=0;
 const to=r.game.tiles.find(t=>neighbors(t,from));
 assert.throws(()=>applyAction(r,p.id,{type:'road',edge:edgeId(from.id,to.id)}),/wood and brick/);
});
