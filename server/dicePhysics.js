
import * as CANNON from 'cannon-es';
import {randomInt} from 'node:crypto';

// Trusted, server-side rigid-body dice. The throw vector from the human player
// influences motion, but a secret random initial rotation/spin prevents clients
// from deterministically choosing an outcome. The result is read from the
// uppermost physical cube face after its collision simulation.
const rand=(min,max)=>min+randomInt(0,1_000_000)/1_000_000*(max-min);
const limited=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;
const faceNormals=[
 [1,new CANNON.Vec3(0,1,0)],
 [6,new CANNON.Vec3(0,-1,0)],
 [3,new CANNON.Vec3(1,0,0)],
 [4,new CANNON.Vec3(-1,0,0)],
 [2,new CANNON.Vec3(0,0,1)],
 [5,new CANNON.Vec3(0,0,-1)]
];
export function rollPhysics(count=2,throwInfo=null){
 if(!Number.isSafeInteger(count)||count<1||count>5)throw Error('Dice count must be 1 to 5.');
 const sx=limited(throwInfo?.vx,-2,2),sy=limited(throwInfo?.vy,-2,2);
 const duration=limited(throwInfo?.durationMs,100,1200);
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-13,0)});
 world.allowSleep=true;
 const bone=new CANNON.Material('bone'),wood=new CANNON.Material('wood');
 world.addContactMaterial(new CANNON.ContactMaterial(bone,wood,{friction:.42,restitution:.37}));
 world.addContactMaterial(new CANNON.ContactMaterial(bone,bone,{friction:.25,restitution:.34}));
 const staticBox=(dims,position)=>{
  const body=new CANNON.Body({mass:0,material:wood,shape:new CANNON.Box(new CANNON.Vec3(dims[0]/2,dims[1]/2,dims[2]/2))});
  body.position.set(...position);world.addBody(body);
 };
 staticBox([4.25,.2,3.25],[0,-.14,0]);
 staticBox([.2,.48,3.25],[-2.07,.16,0]);
 staticBox([.2,.48,3.25],[2.07,.16,0]);
 staticBox([4.25,.48,.2],[0,.16,-1.59]);
 staticBox([4.25,.48,.2],[0,.16,1.59]);
 const gain=Math.min(1.8,Math.max(.6,Math.hypot(sx,sy)*3));
 const bodies=[];
 for(let i=0;i<count;i++){
  const body=new CANNON.Body({mass:.5,material:bone,shape:new CANNON.Box(new CANNON.Vec3(.34,.34,.34)),
   linearDamping:.32,angularDamping:.18,allowSleep:true,sleepSpeedLimit:.12,sleepTimeLimit:1.3});
  body.position.set((i-(count-1)/2)*.20,1.1+i*.21,-.25+rand(-.15,.15));
  body.quaternion.setFromEuler(rand(0,Math.PI*2),rand(0,Math.PI*2),rand(0,Math.PI*2));
  body.velocity.set(sx*3.5+(.5-i)*1.2+rand(-1.1,1.1),4.5*gain+rand(.1,1.5),sy*2.8-1+rand(-1,1));
  body.angularVelocity.set((i%2?1:-1)*(10+duration*.012)+rand(-8,8),8+i*2+rand(-8,8),13-i*2+rand(-7,7));
  world.addBody(body);bodies.push(body);
 }
 for(let step=0;step<270;step++)world.step(1/60);
 return bodies.map(body=>{
  let best=-Infinity,value=1;
  for(const [number,local] of faceNormals){
   const y=body.quaternion.vmult(local).y;
   if(y>best){best=y;value=number;}
  }
  return value;
 });
}
