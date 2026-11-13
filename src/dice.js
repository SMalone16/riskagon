
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Physics-enabled multiplayer dice stage. Clients control the throw, while the
// game server remains the authority over numbered results and combat fairness.
const faces=[
 {value:1,axis:[0,1,0],layout:[[0,0]]},
 {value:6,axis:[0,-1,0],layout:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]},
 {value:3,axis:[1,0,0],layout:[[-1,-1],[0,0],[1,1]]},
 {value:4,axis:[-1,0,0],layout:[[-1,-1],[-1,1],[1,-1],[1,1]]},
 {value:2,axis:[0,0,1],layout:[[-1,-1],[1,1]]},
 {value:5,axis:[0,0,-1],layout:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]]}
];
const orientation=n=>{
 const q=new THREE.Quaternion();
 if(n===2)q.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 if(n===3)q.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
 if(n===4)q.setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2);
 if(n===5)q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
 if(n===6)q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);
 return q;
};
const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.03});
function makeDie(color=0xf2eddf){
 const group=new THREE.Group();
 const cube=new THREE.Mesh(new THREE.BoxGeometry(.68,.68,.68),mat(color));cube.castShadow=true;cube.receiveShadow=true;group.add(cube);
 const pips=mat(0x26353a);
 const sphere=new THREE.SphereGeometry(.043,10,8);
 for(const face of faces){
  const axis=new THREE.Vector3(...face.axis);
  const up=Math.abs(axis.y)>.5?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const u=new THREE.Vector3().crossVectors(up,axis).normalize();
  const v=new THREE.Vector3().crossVectors(axis,u).normalize();
  for(const [i,j] of face.layout){
   const position=axis.clone().multiplyScalar(.345).addScaledVector(u,.18*i).addScaledVector(v,.18*j);
   const p=new THREE.Mesh(sphere,pips);p.position.copy(position);group.add(p);
  }
 }
 return group;
}
export class DiceTray{
 constructor(element,onThrow){
  this.element=element;this.onThrow=onThrow;this.dragging=null;this.running=false;this.result=[1,1];this.mode='idle';this.pending=null;
  this.scene=new THREE.Scene();
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x777a58,3));
  const sun=new THREE.DirectionalLight(0xffe1ae,3);sun.position.set(-4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;this.scene.add(sun);
  this.camera=new THREE.PerspectiveCamera(38,1,.1,50);this.camera.position.set(0,6.1,7.9);this.camera.lookAt(0,.3,0);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  this.renderer.setClearColor(0x000000,0);
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.8;
  element.appendChild(this.renderer.domElement);
  this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-13,0)});
  this.world.allowSleep=true;
  this.diceMaterial=new CANNON.Material('bone');
  const tableMaterial=new CANNON.Material('wood');
  this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial,tableMaterial,{friction:.42,restitution:.37}));
  this.world.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial,this.diceMaterial,{friction:.25,restitution:.34}));
  const addStatic=(dimensions,position,wall=false)=>{
   const body=new CANNON.Body({mass:0,material:tableMaterial,shape:new CANNON.Box(new CANNON.Vec3(...dimensions.map(x=>x/2)))});
   body.position.set(...position);this.world.addBody(body);
   if(wall){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dimensions),mat(0x886943));
    mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);
   }
  };
  const table=new THREE.Mesh(new THREE.BoxGeometry(4.25,.24,3.25),mat(0x567368));
  table.position.y=-.16;table.receiveShadow=true;this.scene.add(table);
  addStatic([4.25,.2,3.25],[0,-.14,0]);
  addStatic([.20,.48,3.25],[-2.07,.16,0],true);
  addStatic([.20,.48,3.25],[2.07,.16,0],true);
  addStatic([4.25,.48,.20],[0,.16,-1.59],true);
  addStatic([4.25,.48,.20],[0,.16,1.59],true);
  this.dice=[];
  for(let i=0;i<5;i++){
   const mesh=makeDie(i<3?0xf3e4c8:0xd79b8a);
   this.scene.add(mesh);
   const body=new CANNON.Body({mass:.5,material:this.diceMaterial,shape:new CANNON.Box(new CANNON.Vec3(.34,.34,.34)),linearDamping:.32,angularDamping:.18,sleepSpeedLimit:.12,sleepTimeLimit:1.3});
   body.position.set((i%3-1)*1.0,1.0+(i%2)*.3,i<3?0:.5);
   this.world.addBody(body);
   this.dice.push({mesh,body,goal:1});
  }
  this.configure(2);
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  const canvas=this.renderer.domElement;canvas.style.touchAction='none';
  canvas.addEventListener('pointerdown',e=>this.down(e));
  canvas.addEventListener('pointermove',e=>this.move(e));
  canvas.addEventListener('pointerup',e=>this.up(e));
  canvas.addEventListener('pointercancel',e=>this.up(e));
  this.resizeObs=new ResizeObserver(()=>this.resize());this.resizeObs.observe(element);this.resize();
  this.prev=performance.now();
  this.animate();
 }
 configure(count){
  this.visibleDice=count;
  this.dice.forEach((die,i)=>{
   die.mesh.visible=i<count;
   die.body.collisionResponse=i<count;
   if(i<count){
    die.body.type=CANNON.Body.DYNAMIC;
    die.body.position.set((i-(count-1)/2)*.83,.48,(i%2)*.25);
    die.body.velocity.set(0,0,0);die.body.angularVelocity.set(0,0,0);
    die.body.quaternion.set(0,0,0,1);die.body.wakeUp();
   }else{die.body.position.set(0,-10,0);die.body.velocity.set(0,0,0);}
  });
 }
 setMode(mode){
  this.mode=mode;
  this.element.classList.toggle('armed',mode==='resource');
  if(mode==='resource'&&this.visibleDice!==2)this.configure(2);
  if(mode==='idle'&&this.visibleDice!==2)this.configure(2);
 }
 point(e){
  const rect=this.renderer.domElement.getBoundingClientRect();
  this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  this.raycaster.setFromCamera(this.pointer,this.camera);
  const hit=new THREE.Vector3();
  this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-1.1),hit);
  return hit;
 }
 down(e){
  if(this.running||this.mode!=='resource')return;
  const rect=this.renderer.domElement.getBoundingClientRect();
  this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  this.raycaster.setFromCamera(this.pointer,this.camera);
  let target=null;
  for(let i=0;i<2;i++){
   const hits=this.raycaster.intersectObject(this.dice[i].mesh,true);
   if(hits.length&&(!target||hits[0].distance<target.distance))target={index:i,distance:hits[0].distance};
  }
  // The tray itself is a generous hit target on touch screens.
  if(!target)target={index:0,distance:0};
  this.dragging={index:target.index,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,time:performance.now()};
  const die=this.dice[target.index];
  die.body.type=CANNON.Body.KINEMATIC;die.body.velocity.set(0,0,0);die.body.angularVelocity.set(0,0,0);
  this.renderer.domElement.setPointerCapture(e.pointerId);
  this.move(e);
 }
 move(e){
  if(!this.dragging)return;
  const p=this.point(e);
  const die=this.dice[this.dragging.index];
  if(p){die.body.position.set(Math.max(-1.48,Math.min(1.48,p.x)),1.1,Math.max(-.99,Math.min(.99,p.z)));}
  die.body.quaternion.setFromEuler((e.clientY-this.dragging.startY)*.014,(e.clientX-this.dragging.startX)*.02,0);
  this.dragging.lastX=e.clientX;this.dragging.lastY=e.clientY;
 }
 async up(e){
  if(!this.dragging)return;
  const drag=this.dragging;this.dragging=null;
  const speedX=(e.clientX-drag.startX)/Math.max(180,this.element.clientWidth);
  const speedY=(e.clientY-drag.startY)/Math.max(180,this.element.clientHeight);
  const duration=performance.now()-drag.time;
  this.throwMotion(speedX,speedY,duration);
  this.running=true;this.element.classList.add('rolling');
  let outcome;
  try{outcome=await this.onThrow?.();}
  catch(err){this.element.classList.remove('rolling');this.running=false;this.setMode('resource');return;}
  if(!outcome?.dice){this.element.classList.remove('rolling');this.running=false;return;}
  this.result=outcome.dice;
  await this.settle(outcome.dice);
  this.running=false;this.element.classList.remove('rolling');this.setMode('idle');
 }
 throwMotion(sx=0,sy=0,duration=250){
  for(let i=0;i<this.visibleDice;i++){
   const b=this.dice[i].body;
   b.type=CANNON.Body.DYNAMIC;b.wakeUp();
   b.position.set(i*.25-.12,1.1+i*.19,-.25);
   const gain=Math.min(1.8,Math.max(.6,Math.hypot(sx,sy)*3));
   b.velocity.set(sx*3.5+(.5-i)*1.2,4.5*gain,sy*2.8-1);
   b.angularVelocity.set((i%2?1:-1)*(10+duration*.012),8+i*2,13-i*2);
  }
 }
 async settle(values){
  await new Promise(resolve=>setTimeout(resolve,950));
  const start=performance.now();
  return new Promise(resolve=>{
   const targets=values.map(n=>orientation(n));
   const from=values.map((_,i)=>this.dice[i].mesh.quaternion.clone());
   const tick=()=>{
    const t=Math.min(1,(performance.now()-start)/300);
    for(let i=0;i<values.length&&i<this.visibleDice;i++){
     const die=this.dice[i];die.body.type=CANNON.Body.KINEMATIC;
     die.body.position.set((i-(values.length-1)/2)*.83,.37,0);
     const q=from[i].clone().slerp(targets[i],1-Math.pow(1-t,3));
     die.body.quaternion.set(q.x,q.y,q.z,q.w);
    }
    if(t<1)requestAnimationFrame(tick);else resolve();
   };tick();
  });
 }
 async playCombat(rounds){
  if(!rounds?.length)return;
  this.mode='combat';this.running=true;this.element.classList.add('rolling','battle');
  const limit=Math.min(rounds.length,9);
  for(let j=0;j<limit;j++){
   const turn=rounds[j],values=[...turn.attack,...turn.defense];
   this.configure(Math.min(values.length,5));
   this.throwMotion(.2+.12*j,-.15,100);
   await new Promise(resolve=>setTimeout(resolve,420));
   await this.settleQuick(values);
  }
  this.running=false;this.element.classList.remove('rolling','battle');this.configure(2);this.setMode('idle');
 }
 async settleQuick(values){
  for(let i=0;i<Math.min(values.length,this.visibleDice);i++){
   const die=this.dice[i];die.body.type=CANNON.Body.KINEMATIC;
   const q=orientation(values[i]);die.body.quaternion.set(q.x,q.y,q.z,q.w);
   die.body.position.set((i-(this.visibleDice-1)/2)*.73,.37,(i%2)*.23);
  }
  await new Promise(resolve=>setTimeout(resolve,230));
 }
 resize(){
  const width=Math.max(1,this.element.clientWidth),height=Math.max(1,this.element.clientHeight);
  this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  this.renderer.setSize(width,height);
 }
 animate(){
  const now=performance.now(),dt=Math.min(.08,(now-this.prev)/1000);this.prev=now;
  this.world.step(1/60,dt,4);
  for(const die of this.dice){
   die.mesh.position.set(die.body.position.x,die.body.position.y,die.body.position.z);
   die.mesh.quaternion.set(die.body.quaternion.x,die.body.quaternion.y,die.body.quaternion.z,die.body.quaternion.w);
  }
  this.renderer.render(this.scene,this.camera);
  this.frame=requestAnimationFrame(()=>this.animate());
 }
 destroy(){cancelAnimationFrame(this.frame);this.resizeObs.disconnect();this.renderer.dispose();}
}
