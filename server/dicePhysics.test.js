import test from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {rollPhysics,simulateRoll,upperFace,createDiceWorld,applyTerrain} from './dicePhysics.js';
import {generateMap} from './realm.js';
import {hexPosition,tileUnder,boundaryEdges,TERRAIN_PHYSICS} from '../shared/boardGeometry.js';
test('server dice reject invalid counts and clamp untrusted throw inputs',()=>{
 assert.equal(rollPhysics(2,{vx:NaN,vy:Infinity,durationMs:'bad'}).length,2);
 assert.equal(rollPhysics(5,{vx:100,vy:-100,durationMs:30000}).length,5);
 for(const n of [0,6,1.5,NaN])assert.throws(()=>rollPhysics(n),/Dice count/);
});
test('recorded final upward faces exactly match authoritative dice and sum',()=>{
 const roll=simulateRoll(2,{vx:3,vz:-4},generateMap());
 assert.equal(roll.dice.length,2);
 assert.equal(roll.sum,roll.dice.reduce((a,b)=>a+b,0));
 for(const [i,p] of roll.frames.at(-1).entries()){
  const face=upperFace(p.slice(3));assert.equal(face.value,roll.dice[i]);assert.ok(face.normal.y>.985);
 }
 assert.equal(roll.durationMs,(roll.frames.length-1)/roll.fps*1000);
 assert.ok(roll.frames.every(f=>f.every(p=>p.length===7&&p.every(Number.isFinite))));
});
test('every exposed edge has a tall collider and colliders use their actual world transforms',()=>{
 const tiles=generateMap(),{world}=createDiceWorld(tiles),edges=boundaryEdges(tiles);
 const walls=world.bodies.filter(b=>b.shapes[0].halfExtents?.y===7);
 assert.equal(walls.length,66);assert.equal(walls.length,edges.length);
 for(const wall of walls){wall.updateAABB();assert.ok(wall.aabb.lowerBound.y<0);assert.ok(wall.aabb.upperBound.y>12);}
});
test('aggressive throws stay above the floor and inside all six sides, including the near edge',()=>{
 const tiles=generateMap();
 for(const t of tiles)t.terrain='fields';
 for(const [vx,vz] of [[12,0],[-12,0],[6,12],[-6,12],[6,-12],[-6,-12]]){
  const roll=simulateRoll(2,{vx,vz,x:0,z:0,durationMs:1200},tiles);
  for(const frame of roll.frames)for(const p of frame){
   assert.ok(p[1]>.1,'die crossed the board bottom');
   assert.ok(tileUnder(tiles,p[0],p[2]),'die crossed a perimeter wall');
  }
 }
});
test('terrain applies neutral fields, forest drag, sticky clay, mountain rebound and stable buoyancy',()=>{
 const body=()=>{const b=new CANNON.Body({mass:1});b.position.set(0,.6,0);b.velocity.set(5,0,0);return b;};
 const fields=body(),forest=body(),clay=body(),water=body();
 applyTerrain(fields,{terrain:'fields'},1);applyTerrain(forest,{terrain:'forest'},1);applyTerrain(clay,{terrain:'hills'},1);
 assert.equal(fields.velocity.x,5);assert.ok(forest.velocity.x<1);assert.ok(clay.velocity.x<forest.velocity.x);
 applyTerrain(water,{terrain:'lake'},1/120);assert.equal(water.force.y,16);
 water.position.y=.4;water.force.setZero();applyTerrain(water,{terrain:'lake'},1/120);assert.ok(water.force.y>16);
 water.position.y=.8;water.force.setZero();applyTerrain(water,{terrain:'lake'},1/120);assert.ok(water.force.y<16);
 assert.ok(TERRAIN_PHYSICS.mountains.restitution>TERRAIN_PHYSICS.fields.restitution);
 const tiles=generateMap().map(t=>({...t,terrain:'lake'}));
 const roll=simulateRoll(2,{vx:0,vz:0},tiles);
 for(const p of roll.frames.at(-1))assert.ok(Math.abs(p[1]-.6)<.03,'water die failed to float at equilibrium');
});
