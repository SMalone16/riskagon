
import * as THREE from 'three';
// Original lightweight 3D unit meshes, styled for the KayKit terrain palette.
// No external troop art is required; replaceable with licensed character GLBs.
const material=color=>new THREE.MeshStandardMaterial({color,roughness:.89,flatShading:true});
function add(group,geo,color,x,y,z,rotation=null){
 const mesh=new THREE.Mesh(geo,material(color));mesh.position.set(x,y,z);
 if(rotation)mesh.rotation.set(...rotation);
 mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
const box=(g,c,w,h,d,x,y,z)=>add(g,new THREE.BoxGeometry(w,h,d),c,x,y,z);
const ball=(g,c,r,x,y,z,w=9,h=7)=>add(g,new THREE.SphereGeometry(r,w,h),c,x,y,z);
const cone=(g,c,r,h,x,y,z,n=6)=>add(g,new THREE.ConeGeometry(r,h,n),c,x,y,z);
const cylinder=(g,c,r0,r1,h,x,y,z,n=8)=>add(g,new THREE.CylinderGeometry(r0,r1,h,n),c,x,y,z);
export function makeTroop(color,kind='infantry',scale=1){
 const u=new THREE.Group(),armor=0x56666b,steel=0xdce1d1,skin=0xe1b58c,leather=0x745642,cloak=color;
 u.scale.setScalar(scale);
 if(kind==='cavalry'){
  const horse=new THREE.Group();u.add(horse);
  const body=box(horse,0x806548,.58,.33,.23,0,.43,0);
  for(const x of [-.2,.2])for(const z of [-.08,.08])cylinder(horse,0x604934,.057,.06,.4,x,.15,z,7);
  box(horse,0x886c50,.22,.33,.2,.30,.60,0);
  ball(horse,0x927456,.14,.36,.78,0);
  cone(horse,0x513b2f,.12,.20,-.32,.44,-.03,7).rotation.z=-Math.PI/2;
  const rider=makeTroop(color,'infantry',.7);rider.position.set(-.05,.58,0);horse.add(rider);
  return u;
 }
 // Boots and tunic
 for(const z of [-.085,.085]){
  box(u,0x4b5051,.12,.12,.14,.02,.06,z);
  cylinder(u,leather,.065,.066,.26,.02,.22,z,7);
 }
 cylinder(u,color,.18,.16,.34,0,.45,0,7);
 // Metallic pauldrons and gauntlets
 for(const x of [-.18,.18]){
  ball(u,armor,.11,x,.56,0);
  cylinder(u,skin,.062,.065,.24,x,.38,0,7);
  ball(u,steel,.075,x,.24,0);
 }
 // Face and cheek guards
 cylinder(u,skin,.118,.109,.18,0,.75,0,10);
 ball(u,armor,.145,0,.87,0,10,7);
 const crest=cone(u,color,.08,.16,0,1.02,0,6);
 box(u,steel,.075,.035,.03,-.045,.80,.12);
 box(u,steel,.075,.035,.03,.045,.80,.12);
 // Back cape, plate breast and belt
 box(u,cloak,.28,.28,.045,0,.40,-.15).rotation.x=-.13;
 box(u,0xd7d9c9,.24,.22,.028,0,.5,.152);
 box(u,leather,.34,.052,.30,0,.33,0);
 if(kind==='archer'){
  const bow=cylinder(u,leather,.029,.031,.8,.29,.51,.10,7);bow.rotation.z=.23;
  box(u,steel,.018,.86,.014,.32,.55,.13);
  for(let i=0;i<3;i++)box(u,0xe6d8ad,.012,.44,.012,-.12+i*.055,.56,-.19);
 }else{
  // Sword, blade, hilt and shield
  const handle=cylinder(u,leather,.037,.039,.19,.24,.39,.08);
  const blade=box(u,steel,.075,.52,.024,.24,.72,.08);blade.rotation.z=.20;
  box(u,0xb29a5f,.25,.055,.060,.24,.48,.08);
  const shield=cylinder(u,color,.22,.20,.045,-.24,.47,.10,8);shield.rotation.x=Math.PI/2;
  const boss=ball(u,steel,.05,-.24,.47,.14);
  boss.scale.z=.6;
 }
 u.userData.troop=true;
 return u;
}
