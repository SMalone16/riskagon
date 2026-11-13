import * as THREE from 'three';
import {DIE_SIZE,hexPosition,tileUnder} from '../shared/boardGeometry.js';
const faces=[
 {value:1,axis:[0,1,0],layout:[[0,0]]},
 {value:6,axis:[0,-1,0],layout:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]},
 {value:3,axis:[1,0,0],layout:[[-1,-1],[0,0],[1,1]]},
 {value:4,axis:[-1,0,0],layout:[[-1,-1],[-1,1],[1,-1],[1,1]]},
 {value:2,axis:[0,0,1],layout:[[-1,-1],[1,1]]},
 {value:5,axis:[0,0,-1],layout:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]]}
];
function makeDie(){
 const group=new THREE.Group(),half=DIE_SIZE/2;
 const cube=new THREE.Mesh(new THREE.BoxGeometry(DIE_SIZE,DIE_SIZE,DIE_SIZE),new THREE.MeshStandardMaterial({color:0xffefd0,roughness:.48}));
 cube.castShadow=true;cube.receiveShadow=true;group.add(cube);
 const material=new THREE.MeshStandardMaterial({color:0x20373c}),geometry=new THREE.SphereGeometry(.064,10,8);
 for(const face of faces){
  const axis=new THREE.Vector3(...face.axis),up=Math.abs(axis.y)>.5?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const u=new THREE.Vector3().crossVectors(up,axis).normalize(),v=new THREE.Vector3().crossVectors(axis,u).normalize();
  for(const [i,j] of face.layout){
   const pip=new THREE.Mesh(geometry,material);
   pip.position.copy(axis).multiplyScalar(half+.008).addScaledVector(u,.27*i).addScaledVector(v,.27*j);group.add(pip);
  }
 }
 return group;
}
// Playback of the server's recorded transforms: no second simulation or result snap.
export class BoardDice{
 constructor(board,onThrow,onError){
  this.board=board;this.onThrow=onThrow;this.onError=onError;this.mode='idle';this.running=false;this.replay=null;this.lastId=null;
  this.dice=[makeDie(),makeDie()];this.dice.forEach(m=>board.scene.add(m));
  this.place();
  const canvas=board.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>this.down(e),true);
  canvas.addEventListener('pointermove',e=>this.move(e),true);
  canvas.addEventListener('pointerup',e=>this.up(e),true);
  canvas.addEventListener('pointercancel',()=>this.cancel(),true);
  canvas.addEventListener('lostpointercapture',()=>this.cancel());
 }
 setMode(mode){
  if(this.mode!==mode&&mode==='resource'&&!this.running){this.replay=null;this.place();}
  this.mode=mode;
 }
 place(){
  const tile=this.board.tiles.find(t=>t.owner===this.board.options.myId)||this.board.tiles.find(t=>t.terrain==='fields')||{q:0,r:0};
  const p=hexPosition(tile);
  this.dice.forEach((mesh,i)=>{mesh.position.set(p.x+(i-.5)*1.15,1.6,p.z);mesh.quaternion.identity();});
 }
 point(e){
  const rect=this.board.renderer.domElement.getBoundingClientRect();
  const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.board.camera);
  return {ray,point:ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-2),new THREE.Vector3())};
 }
 down(e){
  if(this.mode!=='resource'||this.running||e.button!==0)return;
  const {ray,point}=this.point(e);
  if(!point||!ray.intersectObjects(this.dice,true).length)return;
  e.stopImmediatePropagation();e.preventDefault();
  this.dragging={start:point.clone(),last:point.clone(),time:performance.now(),pointerId:e.pointerId};
  this.board.controls.enabled=false;this.board.pointerDown=null;
  this.board.renderer.domElement.setPointerCapture(e.pointerId);
 }
 move(e){
  if(!this.dragging)return;
  e.stopImmediatePropagation();e.preventDefault();
  const {point}=this.point(e);if(!point||!tileUnder(this.board.tiles,point.x,point.z))return;
  this.dragging.last.copy(point);
  this.dice.forEach((mesh,i)=>mesh.position.set(point.x+(i-.5)*1.1,2+i*.3,point.z));
 }
 cancel(){this.dragging=null;this.board.controls.enabled=true;}
 up(e){
  if(!this.dragging)return;
  e.stopImmediatePropagation();e.preventDefault();
  const drag=this.dragging,elapsed=performance.now()-drag.time;
  this.cancel();
  this.throw({x:drag.last.x,z:drag.last.z,vx:(drag.last.x-drag.start.x)*2,vz:(drag.last.z-drag.start.z)*2,durationMs:elapsed});
 }
 async throw(info){
  if(this.running||this.mode!=='resource')return;
  this.running=true;
  try{await this.onThrow(info||{x:this.dice[0].position.x,z:this.dice[0].position.z,vx:4,vz:-3,durationMs:400});}
  catch(error){this.running=false;this.onError(error.message);}
 }
 play(roll,serverNow){
  if(!roll?.frames||roll.id===this.lastId)return;
  this.lastId=roll.id;this.replay=roll;this.running=true;this.cancel();
  this.playStart=performance.now()-Math.max(0,(serverNow??Date.now())-roll.startedAt);
  // Give all players an unobstructed view of the dice on the map.
  this.board.reset();
 }
 update(now){
  if(!this.replay)return;
  const frame=Math.min(this.replay.frames.length-1,Math.max(0,(now-this.playStart)/1000*this.replay.fps));
  const a=this.replay.frames[Math.floor(frame)],b=this.replay.frames[Math.min(Math.floor(frame)+1,this.replay.frames.length-1)],t=frame%1;
  this.dice.forEach((mesh,i)=>{
   mesh.position.fromArray(a[i]).lerp(new THREE.Vector3().fromArray(b[i]),t);
   mesh.quaternion.fromArray(a[i],3).slerp(new THREE.Quaternion().fromArray(b[i],3),t);
  });
  if(frame===this.replay.frames.length-1)this.running=false;
 }
}
