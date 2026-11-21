import * as T from 'three';
import {CREWS} from '../shared/enterprise.js';
import {BIOMES} from '../shared/maps.js';
function part(g,geo,color,x,y,z){
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.8,flatShading:true}));
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
const block=(g,c,w,h,d,x,y,z)=>part(g,new T.BoxGeometry(w,h,d),c,x,y,z);
export function cityProp(kind,crew='blue'){
 const g=new T.Group(),c=CREWS[crew]?.color??0x44556a;
 if(kind==='member'){
  block(g,0x252936,.25,.28,.17,0,.14,0);block(g,c,.33,.29,.2,0,.42,0);
  part(g,new T.SphereGeometry(.115,8,7),0xb98663,0,.65,0);
  block(g,c,.24,.07,.25,0,.74,.02);
 }else if(kind==='police'){
  block(g,0x25354b,.95,.22,.42,0,.21,0);block(g,0xe5e8e6,.48,.22,.38,0,.41,0);
  for(const x of [-.33,.33])for(const z of [-.22,.22])block(g,0x1d232d,.17,.18,.08,x,.13,z);
  block(g,0xfe3546,.14,.075,.12,-.08,.56,0);block(g,0x3385ff,.14,.075,.12,.08,.56,0);
 }else if(kind==='dice'){
  const cube=block(g,c,.48,.48,.48,0,.33,0);cube.rotation.y=.2;
  for(const [x,z] of [[-.12,-.12],[0,0],[.12,.12]])part(g,new T.SphereGeometry(.038,8,5),0xfff0c8,x,.57,z);
 }else if(kind==='dock'||kind==='boat'){
  for(let i=-2;i<=2;i++)block(g,0xba8658,.18,.09,.65,i*.18,.17,0);
  for(const x of [-.42,.42])block(g,c,.07,.48,.07,x,.24,.25);
 }else{
  const idx=Object.keys(CREWS).indexOf(crew);
  const height=kind==='lab'?.84:kind==='outpost'?.34+.065*idx:.46;
  block(g,kind==='lab'?0xd4e3df:0xb4ada0,.94,height,.7,0,height/2,0);
  block(g,c,1.01,.09,.77,0,height,0);
  block(g,0x293d49,.24,height*.67,.025,-.22,height*.335,.36);
  for(const x of [.08,.31])block(g,0x7bafb5,.16,.17,.025,x,height*.58,.36);
  if(kind==='mill'||kind==='works')for(const x of [-.29,.27])part(g,new T.CylinderGeometry(.13,.14,.39,8),kind==='mill'?0xa8b6ae:0xc08998,x,height+.2,0);
  if(kind==='lab')block(g,0xbae4eb,.35,.28,.38,.22,height+.14,0);
  if(kind==='outpost'&&idx===6){
   for(const x of [-.54,.54])block(g,0xc4b9a5,.08,.23,.86,x,.11,.02);
   block(g,c,.7,.22,.08,.1,.11,.47);
  }else if(kind==='outpost'&&idx===5){for(const x of [-.34,.34])block(g,0xe1d1bb,.08,.5,.08,x,.25,.5);}
  else if(kind==='outpost'&&idx===7){for(let i=0;i<4;i++)block(g,0x8c9b99,.37,.035,.025,.12,.08+i*.07,.37);}
  if(kind==='outpost'&&idx%2===0)block(g,c,.55,.16,.3,-.18,height+.1,0);
 }
 return g;
}
let studio;
const cache=new Map();
export function feedPhoto(entry){
 const k=entry.kind||entry.type;
 const subject=entry.type==='police'?'police':/sell|craft|upgrade|refine|roll|dust|glue/.test(k)?'dice':
 ['outpost','settlement','lab','works','mill','barracks','dock','boat'].includes(k)?k:'member';
 const key=[entry.biome,entry.color,subject,k].join('/');
 if(cache.has(key))return cache.get(key);
 studio??=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 studio.setSize(360,200,false);
 const scene=new T.Scene();scene.background=new T.Color(0xe9b8a6);
 scene.add(new T.HemisphereLight(0xfff5ed,0x535081,2.6));
 const sun=new T.DirectionalLight(0xffebbc,2.3);sun.position.set(-2,4,3);scene.add(sun);
 block(scene,BIOMES[entry.biome]?.top??0x97aa97,10,.18,10,0,-.1,0);
 for(let i=0;i<6;i++)block(scene,i%2?0xbc9fa2:0x9daeb7,.52,.6+i%3*.3,.5,i*.7-2,.25,-2-i%2*.3);
 scene.add(cityProp(subject,entry.color||'blue'));
 const witness=cityProp('member',entry.color||'blue');witness.scale.setScalar(.65);witness.position.set(-.73,0,.12);scene.add(witness);
 if(entry.type==='business'&&['mill','works','lab','outpost','settlement','barracks','dock'].includes(k)){
  for(const x of [-.58,.58])block(scene,0xe8b768,.04,.85,.04,x,.42,.35);
  block(scene,0xe2ad5d,1.3,.05,.09,0,.74,.35);
  for(let i=0;i<3;i++)block(scene,0xb5a59d,.24,.08,.16,.66,.05+i*.09,.18);
 }
 if(['dust','glue'].includes(k)||k.startsWith('sell')||entry.type==='police'){
  for(let i=0;i<3;i++)block(scene,i%2?0xad865b:0xcda578,.2,.17,.19,.43+i*.15,.09,.37);
 }
 if(['march','defend','retreat','deploy','hire','confirmDeployment'].includes(k)){
  for(const x of [-.33,.35]){const unit=cityProp('member',entry.color);unit.position.set(x,0,-.3);scene.add(unit);}
 }
 const camera=new T.PerspectiveCamera(34,1.8,.1,30);camera.position.set(1.7,1.25,2.7);camera.lookAt(0,.42,0);
 studio.render(scene,camera);const url=studio.domElement.toDataURL('image/jpeg',.76);
 scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});cache.set(key,url);return url;
}
