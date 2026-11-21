import test from 'node:test';
import assert from 'node:assert/strict';
import {businessOrders,initializeBusiness,market,quote,dispatch,policeDecision} from './enterprise.js';
import {perform,newRealm,finishRoll,visibility,forPlayer,settleTurn} from './realm.js';
import {borderBetween} from '../shared/edges.js';
import {BIOMES} from '../shared/maps.js';
const cell=(q,r,biome,owner)=>({q,r,id:q+','+r,biome,terrain:BIOMES[biome].terrain,owner,number:5,building:0,army:owner?2:0,navy:0,boats:0,structures:[]});
function scenario(){
 const players=[{id:'a',color:'blue',name:'A'},{id:'b',color:'teal',name:'B'}];players.forEach(initializeBusiness);
 const tiles=[cell(0,0,'keys','a'),cell(1,0,'miami','a'),cell(2,0,'beach','a'),cell(0,1,'pine','a'),cell(2,1,'glades','b'),cell(1,1,'ocean',null)];
 const g=newRealm(players,'florida',tiles);Object.assign(g,{phase:'playing',rolled:true,turnStage:'orders'});
 return {players,game:g};
}
const act=(r,t,target)=>perform(r,'a',{type:'enterprise',tile:t.id,target});
test('roll to refine to manual road freight to lab to sale and equipped dice',()=>{
 const room=scenario(),g=room.game,[island,lab,beach,pine,glades]=g.tiles,[a,b]=room.players;
 pine.building=1;glades.building=1;
 Object.assign(g,{turnStage:'rolling',lastRoll:{id:'r1',readyAt:0,sum:5,dice:[2,3]}});
 assert.ok(finishRoll(room));assert.equal(a.rock,3);assert.equal(b.compound,3);assert.equal(a.cash,1800);
 for(const [t,k] of [[island,'mill'],[lab,'lab'],[beach,'works']])act(room,t,k);
 assert.throws(()=>act(room,pine,'lab'));assert.throws(()=>perform(room,'a',{type:'build',tile:pine.id,kind:'dock'}));
 act(room,island,'refineRock');act(room,beach,'refineCompound');
 assert.throws(()=>act(room,island,'dust@'+lab.id));assert.equal(island.stock.dust,1);
 for(const from of [island,beach])perform(room,'a',{type:'road',edge:borderBetween(from,lab)});
 for(let i=0;i<2;i++){
  if(i){act(room,island,'refineRock');act(room,beach,'refineCompound');}
  act(room,island,'dust@'+lab.id);act(room,beach,'glue@'+lab.id);act(room,lab,'craft');act(room,lab,'upgrade');
 }
 assert.equal(a.grade,2);
 lab.stock.dice=15;
 const before=a.cash;for(const n of [1,2,4,8])act(room,lab,'sell'+n);
 assert.equal(a.cash-before,14700);assert.equal(g.phase,'playing');
 lab.stock.dice=1;act(room,lab,'sell1');assert.equal(g.winner,'a');
 const remote=forPlayer(room,'b');assert.equal(remote.game.tiles[0].stock,undefined);
 assert.ok(remote.game.feed.some(e=>e.kind==='lab'&&e.color==='blue'));
});
test('dock freight requires a continuous open water route and both terminals',()=>{
 const r=scenario(),g=r.game,[a,b]=r.players;
 const origin=cell(0,0,'keys',a.id),water=cell(1,0,'ocean',null),end=cell(2,0,'beach',a.id),lab=cell(3,0,'miami',a.id);
 g.tiles=[origin,water,end,lab];origin.stock={dust:1};origin.structures=['dock','mill'];lab.structures=['lab'];end.structures=['dock'];
 g.borders[borderBetween(end,lab)]={road:a.id};
 const can=()=>businessOrders(r,[]).some(o=>o.target==='dust@'+lab.id);
 assert.ok(can());water.owner=b.id;assert.ok(!can());water.owner=null;end.structures=[];assert.ok(!can());
});
test('market quotes use pooled scarcity and debit cash only for missing ingredients plus base price',()=>{
 const r=scenario(),[p,b]=r.players;p.resources.wood=0;b.resources.wood=0;b.resources.ore=100;
 const prices=market(r);assert.ok(prices.wood>prices.ore);assert.equal(quote(p,'dock',prices),80+prices.wood);
 const before=p.cash;act(r,r.game.tiles[2],'dock');assert.equal(p.cash,before-80-prices.wood);assert.equal(p.resources.brick,1);
});
test('seven targets another crew, pauses orders, splits evacuation, clears property and escalates',()=>{
 const r=scenario(),g=r.game,t=g.tiles[4];t.structures=['outpost','lab'];t.building=1;t.stock={dice:3};t.till=120;
 const x=cell(3,1,'miami','b'),y=cell(2,2,'pine','b');g.tiles.push(x,y);
 g.lastRoll={id:'call'};dispatch(r);const c=g.pursuit;
 assert.equal(c.target,'b');assert.equal(c.strength,2);assert.ok(visibility(g,'a').visible.has(c.position));
 // Fix the attack location for deterministic retreat assertions across random spawns.
 c.against=t.id;
 const payload={type:'retreat',call:c.id,step:c.step,allocations:{[x.id]:1,[y.id]:1}};
 assert.throws(()=>perform(r,'a',payload));assert.throws(()=>perform(r,'b',{...payload,allocations:{[x.id]:1}}));
 const turn=g.turn;settleTurn(r,true);assert.equal(g.turn,turn);
 perform(r,'b',payload);assert.equal(x.army,3);assert.equal(y.army,3);assert.equal(t.owner,null);assert.equal(t.structures.length,0);assert.equal(r.players[1].cash,1480);
 assert.throws(()=>perform(r,'b',payload));assert.ok(g.feed.at(-1).text.includes('3 dice'));
 const c2=g.pursuit;
 policeDecision(r,'b',{type:'defend',step:c2.step,call:c2.id},()=>({attackers:0,defenders:1,rounds:[{attack:[1],defense:[6]}]}));
 assert.equal(g.pursuit,null);assert.match(g.feed.at(-1).text,/information/);
 dispatch(r);assert.equal(g.pursuit.strength,4);
});
test('equipped dice add their grade bonus to each battle face in both roles',()=>{
 for(const defender of [true,false]){
  const r=scenario(),g=r.game,[from,to]=g.tiles;
  from.army=3;to.owner='b';to.army=2;r.players[defender?1:0].grade=8;
  perform(r,'a',{type:'march',from:from.id,to:to.id,amount:2});
  const rounds=g.lastBattle.rounds;
  for(const roll of rounds)assert.ok(roll[defender?'defense':'attack'].every(n=>n>=8));
  assert.equal(to.owner,defender?'b':'a');
 }
});
