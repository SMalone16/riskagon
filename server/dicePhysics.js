import * as CANNON from 'cannon-es';
import {randomInt,randomUUID} from 'node:crypto';
import {DIE_SIZE,TILE_TOP,TERRAIN_PHYSICS,hexPosition,tileUnder,boundaryEdges,mountainRocks} from '../shared/boardGeometry.js';
const rand=(min,max)=>min+randomInt(0,1_000_000)/1_000_000*(max-min);
const limited=(n,min,max,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export const FACE_NORMALS=[[1,[0,1,0]],[6,[0,-1,0]],[3,[1,0,0]],[4,[-1,0,0]],[2,[0,0,1]],[5,[0,0,-1]]];
export function upperFace(quaternion){
 const q=new CANNON.Quaternion(...quaternion);
 return FACE_NORMALS.map(([value,normal])=>({value,normal:q.vmult(new CANNON.Vec3(...normal))}))
  .sort((a,b)=>b.normal.y-a.normal.y)[0];
}
const fallbackTiles=()=>{
 const tiles=[];for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.abs(q+r)<=2)tiles.push({q,r,terrain:'fields'});return tiles;
};
export function createDiceWorld(tiles){
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-16,0),allowSleep:true});
 world.broadphase=new CANNON.SAPBroadphase(world);world.solver.iterations=20;
 const bone=new CANNON.Material('bone'),materials={};
 world.addContactMaterial(new CANNON.ContactMaterial(bone,bone,{friction:.3,restitution:.25}));
 const add=(shape,position,material,angle=0)=>{
  const body=new CANNON.Body({mass:0,material,shape});body.position.set(...position);
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),angle);body.aabbNeedsUpdate=true;world.addBody(body);return body;
 };
 for(const [terrain,profile] of Object.entries(TERRAIN_PHYSICS)){
  materials[terrain]=new CANNON.Material(terrain);
  world.addContactMaterial(new CANNON.ContactMaterial(bone,materials[terrain],profile));
 }
 // Continuous thick safety floor, plus tile surfaces, with no bottom seam.
 const extent=Math.max(...tiles.map(t=>Math.max(Math.abs(hexPosition(t).x),Math.abs(hexPosition(t).z))))+3;
 add(new CANNON.Box(new CANNON.Vec3(extent,1,extent)),[0,-1.25,0],materials.fields);
 for(const tile of tiles){
  const p=hexPosition(tile),water=TERRAIN_PHYSICS[tile.terrain]?.water;
  add(new CANNON.Cylinder(1.003,1.003,.5,6),[p.x,(water?-.08:TILE_TOP)-.25,p.z],materials[tile.terrain]||materials.fields,Math.PI/6);
  if(tile.terrain==='mountains')for(const rock of mountainRocks(tile)){
   add(new CANNON.Cylinder(.01,rock.radius,rock.height,6),[rock.x,TILE_TOP+rock.height/2,rock.z],materials.mountains);
  }
 }
 for(const edge of boundaryEdges(tiles)){
  // Full-height walls follow EVERY exposed hex side, including the near/bottom edge.
  add(new CANNON.Box(new CANNON.Vec3(.61,7,.14)),[edge.x,6.5,edge.z],materials.mountains,edge.angle);
 }
 return {world,bone};
}
export function applyTerrain(body,tile,dt){
 const profile=TERRAIN_PHYSICS[tile?.terrain]||TERRAIN_PHYSICS.fields;
 if(profile.water && body.position.y<1.5){
  // Spring buoyancy balances weight at the waterline; drag prevents endless drift.
  body.force.y+=body.mass*(16+45*(.60-body.position.y)-10*body.velocity.y);
  const face=upperFace(body.quaternion.toArray());
  const torque=face.normal.cross(new CANNON.Vec3(0,1,0));
  body.torque.vadd(torque.scale(2.5),body.torque);
  body.angularVelocity.scale(Math.exp(-3*dt),body.angularVelocity);
 }
 if(body.position.y<1.25){
  const damping=Math.exp(-profile.drag*dt);
  body.velocity.x*=damping;body.velocity.z*=damping;
 }
}
const pose=body=>[...body.position.toArray(),...body.quaternion.toArray()].map(n=>Math.round(n*1e5)/1e5);
export function simulateRoll(count=2,throwInfo=null,tiles=fallbackTiles()){
 if(!Number.isSafeInteger(count)||count<1||count>5)throw Error('Dice count must be 1 to 5.');
 const {world,bone}=createDiceWorld(tiles);
 const sx=limited(throwInfo?.vx,-12,12),sz=limited(throwInfo?.vz??throwInfo?.vy,-12,12);
 const duration=limited(throwInfo?.durationMs,100,1200,350);
 const requested={x:limited(throwInfo?.x,-20,20),z:limited(throwInfo?.z,-20,20)};
 const clear=p=>Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>tileUnder(tiles,p.x+1.05*Math.cos(a),p.z+1.05*Math.sin(a)));
 // Preserve the release location unless it would spawn a cube intersecting an edge wall.
 const center=clear(requested)?requested:tiles.map(hexPosition).filter(clear).sort((a,b)=>
  Math.hypot(a.x-requested.x,a.z-requested.z)-Math.hypot(b.x-requested.x,b.z-requested.z))[0]||hexPosition(tiles[0]);
 const bodies=[];
 for(let i=0;i<count;i++){
  const body=new CANNON.Body({mass:1,material:bone,shape:new CANNON.Box(new CANNON.Vec3(DIE_SIZE/2,DIE_SIZE/2,DIE_SIZE/2)),
   linearDamping:.18,angularDamping:.3,allowSleep:true,sleepSpeedLimit:.09,sleepTimeLimit:.6});
  body.position.set(center.x,2+i*2,center.z);
  body.quaternion.setFromEuler(rand(0,6.28),rand(0,6.28),rand(0,6.28));
  body.velocity.set(sx+rand(-1,1),3+duration/400,sz+rand(-1,1));
  body.angularVelocity.set(rand(-12,12),rand(-10,10),rand(-12,12));
  body.aabbNeedsUpdate=true;world.addBody(body);bodies.push(body);
 }
 const frames=[bodies.map(pose)],dt=1/120;
 let stable=0;
 for(let step=1;step<=2880;step++){
  for(const body of bodies){
   applyTerrain(body,tileUnder(tiles,body.position.x,body.position.z),dt);
   // Cocked dice get a small physical hop, never an imposed face or quaternion.
   if(step>480&&step%120===0&&body.velocity.length()<.25&&upperFace(body.quaternion.toArray()).normal.y<.985){
    body.wakeUp();body.velocity.set(rand(-4,4),4,rand(-4,4));body.angularVelocity.set(rand(-5,5),rand(-5,5),rand(-5,5));
   }
  }
  world.step(dt);
  if(step%4===0)frames.push(bodies.map(pose));
  const settled=bodies.every(b=>b.velocity.length()<.12&&b.angularVelocity.length()<.12&&upperFace(b.quaternion.toArray()).normal.y>.985);
  stable=settled?stable+1:0;
  if(step>180&&stable>=60)break;
 }
 if(!bodies.every(b=>upperFace(b.quaternion.toArray()).normal.y>.985&&b.velocity.length()<.2&&b.angularVelocity.length()<.2)){
  throw Error('Dice are cocked. Please roll again.');
 }
 frames.push(bodies.map(pose));
 const dice=frames.at(-1).map(p=>upperFace(p.slice(3)).value);
 return {id:randomUUID(),dice,sum:dice.reduce((a,b)=>a+b,0),frames,fps:30,durationMs:(frames.length-1)/30*1000};
}
export function rollPhysics(count=2,throwInfo=null,tiles){
 // Combat has no grab/retry UI. Reroll a rare cocked throw before returning any outcome.
 for(let attempt=0;attempt<3;attempt++){
  try{return simulateRoll(count,throwInfo,tiles).dice;}
  catch(error){if(!error.message.startsWith('Dice are cocked')||attempt===2)throw error;}
 }
}
