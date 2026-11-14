import test from 'node:test';
import assert from 'node:assert/strict';
import {newRealm,perform,forPlayer,visibility} from './realm.js';
import {chooseBotAction} from './bot.js';
function scenario(){
 const players=[{id:'captain-a',name:'Alpha',resources:{wood:80,brick:80,ore:80,sheep:80,wheat:80}},{id:'captain-b',name:'Beta',resources:{}}];
 const game=newRealm(players);game.phase='playing';game.turnStage='orders';game.rolled=true;game.round=2;game.mobilityCap=20;
 const tile=(id,terrain,owner=null,army=0,building=0,structures=[])=>{const [q,r]=id.split(',').map(Number);return {id,q,r,terrain,owner,army,building,structures,navy:0,boats:0,ward:0,attackStock:0};};
 game.tiles=[tile('0,0','fields',players[0].id,12,1,['outpost']),tile('1,0','lake'),tile('2,0','lake'),tile('2,-1','fields',players[1].id,8,1,['outpost']),tile('1,1','forest')];
 return {players,game};
}
const order=(r,type,args={})=>perform(r,r.players[0].id,{type,...args});
function fleet(r){order(r,'build',{tile:'0,0',kind:'shipyard'});order(r,'launch',{from:'0,0',to:'1,0'});order(r,'embark',{from:'0,0',to:'1,0',amount:4});}
test('shipyards launch boats, crews respect capacity and boats move through connected water only',()=>{
 const r=scenario(),g=r.game;
 assert.throws(()=>order(r,'launch',{from:'0,0',to:'1,0'}),/shipyard/);
 fleet(r);assert.equal(g.tiles[0].army,8);assert.equal(g.tiles[1].navy,4);assert.equal(g.tiles[1].boats,1);
 assert.throws(()=>order(r,'embark',{from:'0,0',to:'1,0',amount:1}),/four troops/);
 assert.throws(()=>order(r,'sail',{from:'1,0',to:'1,1',amount:4}),/connected water/);
 order(r,'sail',{from:'1,0',to:'2,0',amount:4});assert.equal(g.tiles[2].navy,4);assert.equal(g.tiles[1].boats,0);assert.equal(g.tiles[1].owner,null);
});
test('bombardment diminishes garrisons without retaliation unless cannons are present; cannot capture',()=>{
 const r=scenario();fleet(r);const f=r.game.tiles[1],enemy=r.game.tiles[3];
 order(r,'bombard',{from:f.id,to:enemy.id});assert.equal(enemy.army,6);assert.equal(f.navy,4);assert.equal(enemy.owner,r.players[1].id);
 r.game.movement={};enemy.structures.push('cannons');order(r,'bombard',{from:f.id,to:enemy.id});assert.equal(enemy.army,4);assert.equal(f.navy,2);
 r.game.movement={};order(r,'bombard',{from:f.id,to:enemy.id});assert.equal(f.navy,0);assert.equal(f.boats,0);
 assert.throws(()=>order(r,'bombard',{from:f.id,to:enemy.id}),/crewed boat|own territory/);
});
test('naval troops land only through docks and boats stay on water',()=>{
 const r=scenario();fleet(r);const shore=r.game.tiles[4];
 assert.throws(()=>order(r,'land',{from:'1,0',to:shore.id,amount:2}),/dock/);
 order(r,'dock',{tile:shore.id});assert.equal(shore.building,0);
 order(r,'land',{from:'1,0',to:shore.id,amount:2});assert.equal(shore.army,2);assert.equal(r.game.tiles[1].navy,2);assert.equal(r.game.tiles[1].boats,1);
 assert.throws(()=>order(r,'build',{tile:'2,0',kind:'outpost'}),/territory/);
 order(r,'build',{tile:shore.id,kind:'outpost'});assert.equal(shore.building,1);
});
test('fleet splitting cannot strand troops without boats and naval actions obey reinforcement/mobility locks',()=>{
 const r=scenario();fleet(r);
 assert.throws(()=>order(r,'sail',{from:'1,0',to:'2,0',amount:2,boats:1}),/capacity/);
 r.game.movement={'1,0:navy':[{n:4,left:0}]};assert.throws(()=>order(r,'sail',{from:'1,0',to:'2,0',amount:4}),/movement/);
 r.game.turnStage='deploy';assert.throws(()=>order(r,'launch',{from:'0,0',to:'1,0'}),/reinforcements/);
});
test('fleets scout water; hidden boats, cargo, movements and enemy allocations are sanitized',()=>{
 const r=scenario();fleet(r);
 assert.ok(visibility(r.game,r.players[0].id).visible.has('2,0'));
 const far={...r.game.tiles[2],q:8,r:8,id:'8,8',owner:r.players[1].id,boats:3,navy:12};r.game.tiles.push(far);
 const view=forPlayer(r,r.players[0].id);assert.equal(view.game.tiles.at(-1).navy,0);assert.equal(view.game.tiles.at(-1).boats,0);
 r.game.events[0].audience[r.players[1].id]=[];
 const enemy=forPlayer(r,r.players[1].id);assert.equal(enemy.game.events[0].to,null);assert.equal(enemy.game.events[0].kind,null);assert.match(enemy.game.events[0].summary,/built one structure/);
});
test('reinforcement plans are editable, structure-only and require an explicit final confirmation',()=>{
 const r=scenario(),g=r.game,id=r.players[0].id;g.turnStage='deploy';g.reinforcements[id]=5;
 const home=g.tiles[0];g.tiles[4].owner=id;g.tiles[4].army=1;
 assert.throws(()=>order(r,'allocate',{tile:'1,1',count:1}),/outposts or settlements/);
 order(r,'allocate',{tile:home.id,count:3});assert.equal(home.army,12);assert.equal(g.reinforcements[id],2);
 order(r,'allocate',{tile:home.id,count:1});assert.equal(g.reinforcements[id],4);
 assert.throws(()=>order(r,'confirmDeployment'),/every reinforcement/);
 order(r,'allocate',{tile:home.id,count:5});assert.equal(g.turnStage,'deploy');assert.equal(home.army,12);
 order(r,'confirmDeployment');assert.equal(home.army,17);assert.equal(g.turnStage,'orders');
 assert.throws(()=>order(r,'confirmDeployment'),/every reinforcement/);
});
test('AI chooses one legal deployment or naval decision per step',()=>{
 const r=scenario();fleet(r);r.players[0].profile='navalAggro';const action=chooseBotAction(r,{builds:1});assert.equal(action.type,'bombard');order(r,action.type,action);
 r.game.turnStage='deploy';r.game.reinforcements[r.players[0].id]=6;
 const deploy=chooseBotAction(r);assert.equal(deploy.type,'deploy');assert.equal(deploy.count,3);order(r,deploy.type,deploy);
 assert.equal(r.game.turnStage,'deploy');
});
test('coastal structures reject inland and water placement without charging resources',()=>{
 const r=scenario();r.game.tiles[4].owner=r.players[0].id;r.game.tiles[4].building=1;r.game.tiles[4].structures=['outpost'];
 const inland={...r.game.tiles[4],q:8,r:8,id:'8,8'};r.game.tiles.push(inland);
 const before={...r.players[0].resources};assert.throws(()=>order(r,'build',{tile:inland.id,kind:'shipyard'}),/coastal/);
 assert.deepEqual(r.players[0].resources,before);
 r.game.tiles[1].owner=r.players[0].id;
 assert.throws(()=>order(r,'build',{tile:'1,0',kind:'dock'}),/land/);
});
test('split plans remain editable after the pool reaches zero and deploy atomically',()=>{
 const r=scenario(),g=r.game,id=r.players[0].id,home=g.tiles[0],other=g.tiles[4];
 Object.assign(other,{owner:id,building:1,structures:['outpost'],army:2});g.turnStage='deploy';g.reinforcements[id]=5;
 order(r,'allocate',{tile:home.id,count:3});order(r,'allocate',{tile:other.id,count:2});
 assert.equal(g.turnStage,'deploy');assert.equal(home.army,12);assert.equal(other.army,2);
 order(r,'allocate',{tile:home.id,count:2});order(r,'allocate',{tile:other.id,count:3});
 order(r,'confirmDeployment');assert.equal(home.army,14);assert.equal(other.army,5);assert.equal(g.turnStage,'orders');
});
test('remote opponent movement publishes a vague summary without locations, troop counts or raw vision',()=>{
 const r=scenario(),g=r.game;fleet(r);
 const template=g.tiles[1];g.tiles.push({...template,q:8,r:8,id:'8,8',owner:r.players[1].id,navy:2,boats:1},{...template,q:9,r:8,id:'9,8',owner:null,navy:0,boats:0});
 g.turn=1;perform(r,r.players[1].id,{type:'sail',from:'8,8',to:'9,8',amount:2});
 const view=forPlayer(r,r.players[0].id),event=view.game.events.at(-1);
 assert.equal(event.summary,'Beta moved a fleet.');assert.equal(event.from,null);assert.equal(event.to,null);assert.equal(event.amount,null);
 assert.equal(event.audience,undefined);assert.equal(view.game.tiles.at(-1).navy,0);assert.equal(view.game.tiles.at(-1).boats,0);
});
test('a dock without an outpost cannot receive new reinforcements',()=>{
 const r=scenario();fleet(r);order(r,'dock',{tile:'1,1'});
 r.game.turnStage='deploy';r.game.reinforcements[r.players[0].id]=2;
 assert.throws(()=>order(r,'deploy',{tile:'1,1',count:1}),/outposts or settlements/);
 assert.throws(()=>order(r,'allocate',{tile:'1,1',count:1}),/outposts or settlements/);
});
