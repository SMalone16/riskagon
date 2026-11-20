import test from 'node:test';
import assert from 'node:assert/strict';
import {newRealm,turnSeconds,settleTurn,finishRoll,forPlayer} from './realm.js';
function match(){
 const players=['a','b'].map(id=>({id,name:id,resources:{wood:0,brick:0,wheat:0,sheep:0,ore:0}}));
 const game=newRealm(players);
 Object.assign(game,{phase:'playing',turnStage:'orders',rolled:true});
 for(const t of game.tiles)Object.assign(t,{number:null,tavern:false});
 return {players,game};
}
test('turn budgets scale with holdings and stay within bounds',()=>{
 const room=match(),t=room.game.tiles[0];assert.equal(turnSeconds(room),60);
 Object.assign(t,{owner:'a',army:7});room.players[0].resources.ore=10;
 assert.equal(turnSeconds(room),64);room.game.tiles[1].owner='a';assert.equal(turnSeconds(room),66);
 room.players[0].resources.wood=1000;assert.equal(turnSeconds(room),150);
});
test('empty orders pass automatically, a free border order keeps the turn alive',()=>{
 const room=match(),g=room.game;
 Object.assign(g.tiles[0],{owner:'a',army:1});
 settleTurn(room);assert.equal(g.turn,0);assert.ok(room.orders.some(o=>o.type==='gate'));
 g.tiles[0].owner=null;settleTurn(room);assert.equal(g.turn,1);assert.equal(g.turnStage,'roll');
});
test('expiry preserves allocations and settles an ongoing replay before passing',()=>{
 const room=match(),g=room.game,t=g.tiles[0];Object.assign(t,{owner:'a',terrain:'fields',building:1,army:3});
 g.turnStage='rolling';settleTurn(room,true);assert.equal(g.turn,0);
 g.turnStage='deploy';g.allocations.a={[t.id]:1};g.reinforcements.a=2;
 settleTurn(room,true);assert.equal(t.army,6);assert.equal(g.turn,1);
 settleTurn(room,true);assert.equal(g.turn,0);
});
test('all matching hexes celebrate once and each owner receives private unit counts',()=>{
 const room=match(),g=room.game;
 ['a','b',null].forEach((owner,i)=>Object.assign(g.tiles[i],{terrain:'forest',number:4,owner,structures:i===1?['homes']:[]}));
 Object.assign(g,{turnStage:'rolling',lastRoll:{id:'check',sum:4,dice:[2,2],readyAt:100}});
 assert.equal(finishRoll(room,99),false);assert.equal(finishRoll(room,100),true);assert.equal(finishRoll(room,101),false);
 assert.deepEqual(room.players.map(p=>p.resources.wood),[1,2]);
 for(const [i,p] of room.players.entries()){
  const hits=forPlayer(room,p.id).game.harvest.tiles;
  assert.equal(hits.length,3);assert.equal(hits[i].count,i+1);assert.equal(hits[1-i].count,0);assert.ok(hits.every(h=>!('owner' in h)));
 }
});
