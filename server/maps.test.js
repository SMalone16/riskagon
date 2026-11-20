import test from 'node:test';
import assert from 'node:assert/strict';
import {BIOMES,COLORS} from '../shared/maps.js';
import {chooseDraft,currentDrafter,dist,forPlayer,newRealm} from './realm.js';

test('eight kingdoms can draft on the coast, including an offshore homeland',()=>{
 const players=COLORS.map((color,i)=>({id:'p'+i,name:'Kingdom '+i,bot:i>0,profile:'navy'}));
 const game=newRealm(players,'florida'),room={players,game};
 assert.deepEqual(new Set(game.tiles.map(t=>t.biome)),new Set(Object.keys(BIOMES)));
 for(const color of COLORS)chooseDraft(room,currentDrafter(room),'color',color);
 assert.equal(game.spawnChoices.length,game.tiles.length);
 const offshore=game.tiles.find(t=>t.biome==='ocean'&&game.tiles.every(n=>dist(t,n)!==1||n.biome==='ocean'));
 assert.ok(offshore);
 for(let i=0;i<8;i++){
  const home=i?game.spawnChoices[Math.floor(game.spawnChoices.length/2)]:offshore.id;
  assert.ok(home);
  chooseDraft(room,currentDrafter(room),'spawn',home);
  if(i===0){
   assert.equal(offshore.biome,'keys');
   assert.ok(game.tiles.some(t=>dist(offshore,t)===1&&t.boats&&t.owner===offshore.owner));
   for(const t of game.tiles.filter(t=>dist(t,offshore)<=3))assert.ok(!game.spawnChoices.includes(t.id));
   assert.throws(()=>chooseDraft(room,currentDrafter(room),'spawn',offshore.id));
  }
 }
 assert.equal(game.phase,'playing');
 for(const viewer of players)assert.ok(forPlayer(room,viewer.id).players.every(p=>!('profile' in p)));
 for(const a of game.tiles.filter(t=>t.building))for(const b of game.tiles.filter(t=>t.building&&a!==t))assert.ok(dist(a,b)>=4);
});
