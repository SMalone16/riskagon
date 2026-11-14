import {hexEdges,vertexPosition} from '../shared/edges.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {boundaryEdges,mountainRocks} from '../shared/boardGeometry.js';
import {makeTroop} from './troops.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

const SQRT3=Math.sqrt(3);
const FACTIONS={blue:0x4b9eec,red:0xeb756b,green:0x65c5a2,yellow:0xf1c36d};
const TERRAIN={
  forest:{top:0x4e9573,side:0x31715e},
  fields:{top:0xe9c56f,side:0xc49b53},
  pasture:{top:0x91bb78,side:0x608955},
  hills:{top:0xc78a67,side:0x9c654d},
  mountains:{top:0x9ba7a9,side:0x707e82},
  desert:{top:0xe3c48e,side:0xb08f66},
  lake:{top:0x4f9eab,side:0x337784},
  river:{top:0x73b4c3,side:0x3c8295}
};
const pos=t=>new THREE.Vector3(SQRT3*(t.q+t.r/2),0,1.5*t.r);
const makeMat=(color,roughness=.94)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
function mesh(geometry,material,parent,x=0,y=0,z=0){
 const result=new THREE.Mesh(geometry,material);
 result.position.set(x,y,z);result.castShadow=true;result.receiveShadow=true;
 parent.add(result);return result;
}
function cone(parent,color,r,h,x=0,y=0,z=0,sides=5){
 return mesh(new THREE.ConeGeometry(r,h,sides),makeMat(color),parent,x,y,z);
}
function box(parent,color,w,h,d,x=0,y=0,z=0){
 return mesh(new THREE.BoxGeometry(w,h,d),makeMat(color),parent,x,y,z);
}
function pine(parent,x,z,size=1){
 const trunk=box(parent,0x76563d,.13*size,.34*size,.13*size,x,.17*size,z);
 cone(parent,0x296752,.30*size,.52*size,x,.56*size,z,5);
 cone(parent,0x3c8767,.23*size,.46*size,x,.79*size,z,5);
}
function rock(parent,x,z,s=1){
 const m=mesh(new THREE.DodecahedronGeometry(.26*s,0),makeMat(0x889794),parent,x,.2*s,z);
 m.rotation.set(.2,.6,.2);return m;
}
function decor(parent,terrain){
 if(terrain==='forest'){pine(parent,-.28,-.2,1.05);pine(parent,.26,-.06,.83);pine(parent,0,.32,.58);}
 else if(terrain==='mountains'){
  cone(parent,0x74888b,.40,.87,-.20,.45,-.14,5);
  cone(parent,0xa3abad,.31,.65,.29,.34,.20,5);
  cone(parent,0xf4f4e8,.12,.23,-.20,.94,-.14,5);
 }else if(terrain==='fields'){
   for(let i=0;i<9;i++){const x=(i%3-1)*.23,z=(Math.floor(i/3)-1)*.23;
    cone(parent,i%3===0?0xf8df92:0xb7933f,.065,.33,x,.17,z,4);
   }
 }else if(terrain==='pasture'){
   for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    mesh(new THREE.IcosahedronGeometry(.16,0),makeMat(0xc5d7a3),parent,.38*Math.cos(a),.17,.34*Math.sin(a));
   }
 }else if(terrain==='hills'){rock(parent,-.25,.02,1.16);rock(parent,.21,-.18,.88);rock(parent,.23,.30,.65);}
 else if(terrain==='lake'||terrain==='river'){
   const water=mesh(new THREE.CylinderGeometry(.88,.88,.015,6),makeMat(terrain==='lake'?0x58a7b7:0x7cc1cc,.38),parent,0,.035,0);
   water.castShadow=false;
   for(let i=0;i<3;i++)box(parent,0xc5e8da,.17,.012,.025,(i-1)*.34,.045,i%2?.21:-.20);
 }else if(terrain==='desert'){
   const dune=mesh(new THREE.SphereGeometry(.4,9,5),makeMat(0xf1d6a5),parent,-.12,-.11,-.12);
   dune.scale.set(1,.37,.8);
   rock(parent,.31,.25,.43);
 }
}
function soldier(parent,color,x,z,scale=1){
 const unit=new THREE.Group();unit.position.set(x,0,z);unit.scale.setScalar(scale);parent.add(unit);
 mesh(new THREE.CylinderGeometry(.12,.16,.12,7),makeMat(0x333f49),unit,0,.075,0);
 mesh(new THREE.CylinderGeometry(.10,.12,.38,7),makeMat(color),unit,0,.31,0);
 mesh(new THREE.SphereGeometry(.11,8,6),makeMat(0xefc29f),unit,0,.57,0);
 cone(unit,0x46505a,.16,.17,0,.70,0,6);
 box(unit,0xc9ab76,.028,.7,.025,.17,.4,.05);
 const shield=mesh(new THREE.CylinderGeometry(.14,.14,.035,6),makeMat(color),unit,-.14,.32,.08);
 shield.rotation.z=Math.PI/2;
}
function proceduralBuilding(parent,color,level){
 const group=new THREE.Group();parent.add(group);
 if(level===1){
  box(group,0xf2dfbb,.55,.48,.46,0,.25,0);
  const roof=cone(group,color,.44,.38,0,.70,0,4);
  roof.rotation.y=Math.PI/4;
  box(group,0x80573c,.13,.24,.035,0,.14,.245);
 } else {
  box(group,0xbec5b9,.60,.62,.57,0,.34,0);
  box(group,0x9ea7a3,.78,.13,.75,0,.70,0);
  for(const x of [-.3,.3])for(const z of [-.27,.27]){
   mesh(new THREE.CylinderGeometry(.15,.17,.78,6),makeMat(0xa7b0ad),group,x,.46,z);
   cone(group,color,.20,.33,x,1.02,z,6);
  }
  box(group,0x6a4d40,.16,.25,.03,0,.13,.3);
 }
 return group;
}
function boat(color){
 const group=new THREE.Group();
 const hull=box(group,0x6f4b32,1.05,.22,.48,0,.16,0);
 cone(group,0x8d6340,.28,.38,.62,.16,0,4).rotation.z=-Math.PI/2;
 box(group,0xc79a60,.88,.055,.34,0,.30,0);
 box(group,0x5f4631,.045,.9,.045,0,.73,0);
 const sail=new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.03,.43,.03),new THREE.Vector3(.03,1.1,.03),new THREE.Vector3(.48,.45,.03)]),new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.8}));
 group.add(sail);return group;
}
function navalBuilding(parent,kind,color){
 if(kind==='dock'){
  for(let i=0;i<6;i++)box(parent,0xb48a57,.17,.08,.57,(i-2)*.17,.14,0);
  for(const x of [-.4,.4])box(parent,0x6b5135,.08,.4,.08,x,0,.25);
 }else if(kind==='shipyard'){
  box(parent,0xd9d6b2,.8,.6,.7,0,.3,0);cone(parent,color,.64,.4,0,.8,0,4).rotation.y=Math.PI/4;
  const hull=boat(color);hull.scale.setScalar(.45);hull.position.set(.55,0,.15);parent.add(hull);
 }else{
  box(parent,0x806143,.4,.19,.35,0,.13,0);
  const barrel=mesh(new THREE.CylinderGeometry(.09,.13,.65,8),makeMat(0x273a40),parent,.2,.35,0);barrel.rotation.z=-Math.PI*.40;
  for(const z of [-.21,.21]){const wheel=mesh(new THREE.CylinderGeometry(.16,.16,.07,8),makeMat(0x443e32),parent,0,.18,z);wheel.rotation.x=Math.PI/2;}
 }
}
function textSprite(text,color='#453f30',bg='#f7e7c5',size=.37){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const c=canvas.getContext('2d');
 c.beginPath();c.arc(64,64,47,0,Math.PI*2);c.fillStyle=bg;c.fill();
 c.lineWidth=6;c.strokeStyle='#ac946c';c.stroke();
 c.font='bold 53px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,64,68);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
 sprite.scale.set(size,size,1);return sprite;
}
export class Board{
 constructor(container,selectTile,selectEdge){
  this.container=container;this.selectTile=selectTile;this.selectEdge=selectEdge;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x9cbdb6);
  this.scene.fog=new THREE.FogExp2(0x9cbdb6,.012);
  this.camera=new THREE.OrthographicCamera(-9,9,7,-7,.1,100);
  this.camera.position.set(18,24,28);this.camera.lookAt(0,0,0);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=1.55;
  container.appendChild(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.enableDamping=true;this.controls.dampingFactor=.07;
  this.controls.enableRotate=true;this.controls.maxPolarAngle=Math.PI*.44;this.controls.minPolarAngle=Math.PI*.22;
  this.controls.minZoom=.6;this.controls.maxZoom=8;this.controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
  this.scene.add(new THREE.HemisphereLight(0xdaf1ff,0x4c5645,2.5));
  const sun=new THREE.DirectionalLight(0xffedd0,3.0);sun.position.set(-8,16,10);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
  sun.shadow.normalBias=.02;this.scene.add(sun);
  this.world=new THREE.Group();this.scene.add(this.world);
  const sea=mesh(new THREE.CircleGeometry(30,96),makeMat(0x5d9f9e,.75),this.world,0,-.51,0);
  sea.rotation.x=-Math.PI/2;sea.receiveShadow=true;sea.castShadow=false;
  const rim=mesh(new THREE.CylinderGeometry(12.2,12.6,.23,64),makeMat(0x405f57),this.world,0,-.35,0);
  rim.scale.set(1,.5,.91);rim.castShadow=false;
  this.board=new THREE.Group();this.world.add(this.board);
  this.pickables=[];this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.loader=new GLTFLoader();this.models=new Map();this.characterModels=new Map();this.kaykit=false;this.version=0;
  this.tiles=[];this.options={};this.hover=null;this.pointerDown=null;this.keys=new Set();this.effects=[];
  this.hoverOutline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:6},(_,i)=>new THREE.Vector3(Math.sin(i*Math.PI/3)*1.025,0,Math.cos(i*Math.PI/3)*1.025))),new THREE.LineBasicMaterial({color:0xfff2b5,depthTest:false}));
  this.hoverOutline.visible=false;this.hoverOutline.renderOrder=20;this.scene.add(this.hoverOutline);
  this.keyDown=e=>{
   const key=e.key.length===1?e.key.toLowerCase():e.key;
   if(e.defaultPrevented||e.target.closest?.('input,textarea,select,dialog')||!['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))return;
   e.preventDefault();this.keys.add(key);
  };
  this.keyUp=e=>this.keys.delete(e.key.length===1?e.key.toLowerCase():e.key);this.blur=()=>this.keys.clear();
  window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.blur);
  this.lastFrame=performance.now();
  fetch('/assets/kaykit/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json()})
   .then(()=>{this.kaykit=true;this.update(this.tiles,this.options);}).catch(()=>{});
  this.resizeObs=new ResizeObserver(()=>this.resize());this.resizeObs.observe(container);this.resize();
  this.renderer.domElement.addEventListener('pointerdown',e=>{this.pointerDown={x:e.clientX,y:e.clientY};});
  this.renderer.domElement.addEventListener('pointermove',e=>{
   const hit=this.hit(e);const target=hit?.object?.userData;
   this.renderer.domElement.style.cursor=target?.tile||target?.edge?'pointer':'grab';
   this.hover=target?.tile||null;this.refreshHover();this.onHover?.(this.tiles.find(t=>t.id===this.hover));
  });
  this.renderer.domElement.addEventListener('pointerleave',()=>{this.hover=null;this.refreshHover();this.onHover?.(null);});
  this.renderer.domElement.addEventListener('pointerup',e=>{
    if(!this.pointerDown||Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y)>6)return;
    const hit=this.hit(e);if(!hit)return;
    if(hit.object.userData.vertex){this.selectEdge({vertex:hit.object.userData.vertex});return;}
    if(hit.object.userData.edge){this.selectEdge(hit.object.userData.edge);return;}
    if(hit.object.userData.tile)this.selectTile(hit.object.userData.tile);
  });
  this.animate();
 }
 hit(e){
  const rect=this.renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  this.ray.setFromCamera(this.pointer,this.camera);
  return this.ray.intersectObjects(this.pickables,false)[0]||null;
 }
 resize(){
  const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
  const size=13.0,aspect=w/h;
  this.camera.left=-size*aspect;this.camera.right=size*aspect;
  this.camera.top=size;this.camera.bottom=-size;
  this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
 }
 refreshHover(){
  const tile=this.tiles.find(t=>t.id===this.hover);this.hoverOutline.visible=!!tile;
  if(tile){this.hoverOutline.position.copy(pos(tile));this.hoverOutline.position.y=.2;}
 }
 fitDiscovered(){this.fitTiles(this.tiles.filter(t=>t.discovered||t.visible||t.owner===this.options.myId));}
 fitTiles(tiles){
  if(!tiles.length)return;
  const center=tiles.reduce((v,t)=>v.add(pos(t)),new THREE.Vector3()).multiplyScalar(1/tiles.length);
  const offset=this.camera.position.clone().sub(this.controls.target);
  this.controls.target.copy(center);this.camera.position.copy(center).add(offset);this.camera.lookAt(center);this.camera.updateMatrixWorld();
  const points=tiles.flatMap(t=>{const p=pos(t);return [-1.3,1.3].flatMap(x=>[-1.3,1.3].flatMap(z=>[0,2].map(y=>new THREE.Vector3(p.x+x,y,p.z+z).applyMatrix4(this.camera.matrixWorldInverse))));});
  const width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  const height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
  this.camera.zoom=Math.min(8,Math.max(.6,Math.min((this.camera.right-this.camera.left)/(width+1),(this.camera.top-this.camera.bottom)/(height+1))));
  this.camera.updateProjectionMatrix();this.controls.update();
 }
 playEvent(event,players){
  if(!event.from&&!event.to)return;
  const from=this.tiles.find(t=>t.id===event.from),to=this.tiles.find(t=>t.id===event.to);
  const color=FACTIONS[players.find(p=>p.id===event.actor)?.color]||0xe8d5a4;
  const moving=['march','sail','land','embark'].includes(event.type);
  let effect;
  if(moving){effect=event.type==='sail'?boat(color):makeTroop(color,'infantry',1);}
  else{effect=new THREE.Mesh(new THREE.TorusGeometry(.8,.07,6,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthTest:false}));effect.rotation.x=-Math.PI/2;}
  const start=pos(from||to),end=pos(to||from);start.y=.25;end.y=.25;
  this.scene.add(effect);this.effects.push({mesh:effect,start,end,began:performance.now(),moving});
 }
 async prefab(relative){
  if(!this.kaykit)return null;
  if(!this.models.has(relative)){
   this.models.set(relative,new Promise(resolve=>{
    this.loader.load('/assets/kaykit/'+relative+'.gltf',g=>resolve(g.scene),undefined,()=>resolve(null));
   }));
  }
  const item=await this.models.get(relative);
  return item?.clone(true)||null;
 }
 decorateWithPrefab(holder,relative,scale=1){
  if(!this.kaykit)return;
  const version=this.version;
  this.prefab(relative).then(model=>{
   if(!model||version!==this.version)return;
   model.traverse(o=>o.userData.prefab=true);holder.clear();model.scale.setScalar(scale);holder.add(model);
  });
 }
 focus(id){
  const tile=this.tiles.find(t=>t.id===id);if(!tile)return;
  const target=pos(tile);this.controls.target.copy(target);this.camera.position.copy(target).add(new THREE.Vector3(13,19,23));this.camera.zoom=7;this.camera.updateProjectionMatrix();this.controls.update();
 }
 reset(){this.controls.target.set(0,0,0);this.camera.position.set(18,24,28);this.camera.zoom=1;this.camera.updateProjectionMatrix();this.controls.update();}
 async character(name){
  if(!this.kaykit)return null;
  if(!this.characterModels.has(name)){
   const request=new Promise(resolve=>this.loader.load('/assets/kaykit/characters/'+name+'.glb',loaded=>resolve(loaded.scene),undefined,()=>resolve(null)));
   this.characterModels.set(name,request);
  }
  const model=await this.characterModels.get(name);
  return model?cloneSkinned(model):null;
 }
 attachCharacter(holder,name,color,desiredHeight=.66){
  if(!this.kaykit)return;
  const version=this.version;
  this.character(name).then(model=>{
   if(!model||version!==this.version)return;
   const bounds=new THREE.Box3().setFromObject(model),height=bounds.getSize(new THREE.Vector3()).y;
   if(!height||!Number.isFinite(height))return;
   const scale=desiredHeight/height;
   model.traverse(o=>o.userData.prefab=true);holder.clear();model.scale.setScalar(scale);
   model.position.y=-bounds.min.y*scale;
   model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
   holder.add(model);
   // A tabard-colored hex pedestal keeps all army factions unmistakable.
   const banner=mesh(new THREE.CylinderGeometry(.20,.20,.055,6),makeMat(color),holder,0,.025,0);
   banner.castShadow=false;
  });
 }
 update(tiles=[],options={}){
  this.version++;this.tiles=tiles;this.options=options;
  // Dispose rebuilt procedural geometry/materials; cached prefab resources are shared.
  this.board.traverse(object=>{
   if(object.userData.prefab)return;
   object.geometry?.dispose();
   const materials=Array.isArray(object.material)?object.material:[object.material];
   materials.filter(Boolean).forEach(material=>{material.map?.dispose();material.dispose();});
  });
  this.board.clear();this.pickables=[];
  const selected=options.selected,roadMode=options.roadMode;
  this.refreshHover();
  for(const edge of boundaryEdges(tiles)){
   const rail=mesh(new THREE.BoxGeometry(1.13,.25,.13),makeMat(0x496b63),this.board,edge.x,.28,edge.z);
   rail.rotation.y=edge.angle;
  }
  for(const tile of tiles.filter(t=>t.terrain==='mountains'))for(const rock of mountainRocks(tile)){
   mesh(new THREE.CylinderGeometry(.01,rock.radius,rock.height,6),makeMat(0x839496),this.board,rock.x,.16+rock.height/2,rock.z);
  }
  for(const tile of tiles){
   const root=new THREE.Group();root.position.copy(pos(tile));this.board.add(root);
   const colors=TERRAIN[tile.terrain]||TERRAIN.desert;
   const base=mesh(new THREE.CylinderGeometry(1,1,.32,6),[
      makeMat(colors.side),makeMat(colors.top),makeMat(colors.side)
   ],root,0,0,0);
   base.userData.tile=tile.id;this.pickables.push(base);
   const top=new THREE.Group();top.position.y=.17;root.add(top);
   if(selected===tile.id||options.destinations?.includes(tile.id)||options.deploy&&tile.owner===options.myId&&tile.building){
    const points=[];
    for(let i=0;i<6;i++){const theta=i*Math.PI/3;points.push(new THREE.Vector3(Math.sin(theta)*1.013,.04,Math.cos(theta)*1.013));}
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:selected===tile.id?0xffecac:0x7af5c9}));
    top.add(line);
   }
   const nature=new THREE.Group();nature.position.set(tile.condensed?-.38:0,0,tile.condensed?-.32:-.08);nature.scale.setScalar(tile.condensed?.34:1.2);top.add(nature);
   decor(nature,tile.terrain);
   if(tile.terrain==='river'&&tile.bridge){
    const bridge=new THREE.Group();top.add(bridge);
    box(bridge,0x876343,1.5,.12,.56,0,.16,0);
    for(const z of [-.27,.27]){
      for(let j=-3;j<=3;j++)box(bridge,0xc3a374,.17,.10,.12,j*.20,.25,z);
      box(bridge,0x553f32,1.36,.07,.07,0,.38,z);
    }
    const color=FACTIONS[(options.players||[]).find(p=>p.id===tile.bridge)?.color]||0xe7cfa2;
    box(bridge,color,.12,.28,.12,0,.38,0);
   }
   if(this.kaykit){
    const asset={forest:'decoration/nature/trees_A_small',mountains:'decoration/nature/mountain_A_grass',hills:'decoration/nature/hills_A'}[tile.terrain];
    if(asset)this.decorateWithPrefab(nature,asset,tile.terrain==='mountains'?.85:1.08);
   }
   if(tile.number!==null && tile.number!==undefined){
    const token=textSprite(String(tile.number),tile.number===6||tile.number===8?'#a43b32':'#494332','#f7e9cd',.44);
    token.position.set(-.62,.16,.45);top.add(token);
   }
   if(tile.tavern){const tavern=proceduralBuilding(top,0xc8944e,1);tavern.position.x=-.25;const sign=textSprite('T','#fff','#745132',.5);sign.position.set(0,1.2,0);top.add(sign);}
   if(tile.owner){
    const player=(options.players||[]).find(p=>p.id===tile.owner);
    const color=FACTIONS[player?.color]||FACTIONS.blue;
    const flagpost=box(top,0x6f5742,.036,.72,.035,.63,.37,-.48);
    const flag=box(top,color,.26,.16,.02,.77,.67,-.48);
    flag.castShadow=false;
    if(tile.building){
     const holder=proceduralBuilding(top,color,tile.building);
     const rel='buildings/'+(player?.color||'blue')+'/building_'+(tile.building===2?'castle':'home_A')+'_'+(player?.color||'blue');
     this.decorateWithPrefab(holder,rel,tile.building===2?.66:.89);
    }
    if(tile.structures?.length>0){
      const addOn=new THREE.Group();top.add(addOn);
      let n=0;
      for(const kind of tile.structures.filter(x=>!['outpost','settlement'].includes(x))){
       const angle=(n++)*Math.PI*.57+.7;
       const x=.52*Math.cos(angle),z=.52*Math.sin(angle);
       const structure=new THREE.Group();structure.position.set(x,0,z);structure.scale.setScalar(.47);addOn.add(structure);
       if(['shipyard','dock','cannons'].includes(kind)){navalBuilding(structure,kind,color);}
       else if(kind==='walls'){for(let j=-1;j<=1;j++)box(structure,0xa7aca7,.32,.25,.18,j*.36,.13,0);}
       else if(kind==='farm'||kind==='lumberyard'||kind==='quarry'||kind==='mine'||kind==='ranch'){
        box(structure,0xe8d8ae,.53,.28,.40,0,.15,0);
        cone(structure,kind==='farm'?0xe9c778:color,.42,.30,0,.42,0,4).rotation.y=Math.PI/4;
       }else{
        box(structure,0xded7b7,.5,.43,.42,0,.23,0);
        cone(structure,color,.40,.34,0,.61,0,4).rotation.y=Math.PI/4;
       }
      }
    }
    if(tile.boats){const fleet=boat(color);fleet.position.y=.18;top.add(fleet);const label=textSprite(tile.navy+'/'+tile.boats,'#fff','#25495c',.58);label.position.set(.53,.8,.25);top.add(label);}
    const army=new THREE.Group();army.position.set(tile.building?.25:0,0,tile.building?.12:0);top.add(army);
    const addSoldier=(name,kind,x,z,height)=>{
     const holder=new THREE.Group();holder.position.set(x,0,z);army.add(holder);
     holder.add(makeTroop(color,kind,height/.95));
     if(kind!=='cavalry')this.attachCharacter(holder,name,color,height);
    };
    if(tile.army>0)addSoldier('Knight','infantry',-.20,-.15,.64);
    if(tile.army>2)addSoldier('Rogue','archer',.16,-.21,.55);
    if(tile.army>5)addSoldier('Barbarian',tile.structures?.includes('stables')?'cavalry':'infantry',-.03,.20,.52);
    if(tile.army>0){const count=textSprite(String(tile.army),'#fff','#273c4a',.35);count.position.set(.52,.24,.51);top.add(count);}
   }
   if(options.allocations?.[tile.id]){const badge=textSprite('+'+options.allocations[tile.id],'#203d34','#ffe1a1',.65);badge.position.set(0,1.3,0);top.add(badge);}
   const own=tile.owner===options.myId;
   const ownerBorder=tile.owner?new THREE.Mesh(
    new THREE.TorusGeometry(.79,own?.056:.026,5,6),
    makeMat(own?0xffe7a2:(FACTIONS[(options.players||[]).find(p=>p.id===tile.owner)?.color]||0xffffff))
   ):null;
   if(ownerBorder){ownerBorder.rotation.x=-Math.PI/2;ownerBorder.rotation.z=Math.PI/6;ownerBorder.scale.set(1.0,1.0,1.0);ownerBorder.position.y=.012;top.add(ownerBorder);}
   if(options.spawnChoices?.includes(tile.id)){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.77,.085,6,6),makeMat(0xffd581));ring.rotation.x=-Math.PI/2;ring.position.y=.15;top.add(ring);
    const sign=textSprite('★','#3a493d','#f6d78c',.44);sign.position.set(0,.8,0);top.add(sign);
   }
  }
  const vertices=new Set();
  if(options.borderMode)for(const tile of tiles.filter(t=>t.owner===options.myId&&(t.army||t.navy)))for(const edge of hexEdges(tile))for(const key of [edge.a,edge.b]){
   if(vertices.has(key))continue;vertices.add(key);const p=vertexPosition(key);
   const point=mesh(new THREE.SphereGeometry(.13,10,8),makeMat(options.originVertex===key?0xff8866:0xffed9f),this.board,p.x,.4,p.z);point.userData.vertex=key;this.pickables.push(point);
  }
  for(const [key,border] of Object.entries(options.borders||{})){
   const [a,b]=key.split('~').map(vertexPosition);if(!a||!b)continue;
   const length=Math.hypot(a.x-b.x,a.z-b.z),angle=Math.atan2(-(b.z-a.z),b.x-a.x);
   const road=border.road,wall=border.wall,gate=border.gate;
   if(road){const m=mesh(new THREE.BoxGeometry(length,.06,.16),makeMat(0xc5a473),this.board,(a.x+b.x)/2,.23,(a.z+b.z)/2);m.rotation.y=angle;}
   if(wall){for(const part of gate?[-1,1]:[0]){const fraction=gate?.30:1,offset=part*.34;const m=mesh(new THREE.BoxGeometry(length*fraction,.48,.16),makeMat(wall.material==='stone'?0x87959d:0x99663f),this.board,(a.x+b.x)/2+(b.x-a.x)*offset,.42,(a.z+b.z)/2+(b.z-a.z)*offset);m.rotation.y=angle;}}
   if(wall){const hp=textSprite(String(wall.hp),'#fff','#4b5e60',.28);hp.position.set((a.x+b.x)/2,.8,(a.z+b.z)/2);this.board.add(hp);}
   if(gate){const marker=textSprite('G','#fff','#45715c',.3);marker.position.set((a.x+b.x)/2,.8,(a.z+b.z)/2);this.board.add(marker);}
  }
  const shownEdges=new Set();
  for(const tile of tiles){
   for(const other of tiles){
    if(tile===other)continue;
    const dq=tile.q-other.q,dr=tile.r-other.r;
    if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==1)continue;
    const edge=[tile.id,other.id].sort().join('|');
    if(shownEdges.has(edge))continue;
    shownEdges.add(edge);
    const a=pos(tile),b=pos(other),mid=a.clone().add(b).multiplyScalar(.5);
    const direction=new THREE.Vector3(-(b.z-a.z),0,b.x-a.x).normalize();
    const owner=options.roads?.[edge];
    const eligible=roadMode&&!owner&&(tile.owner===options.myId||other.owner===options.myId)&&!['lake','river'].includes(tile.terrain)&&!['lake','river'].includes(other.terrain);
    if(!owner&&!eligible)continue;
    const color=owner?(FACTIONS[(options.players||[]).find(p=>p.id===owner)?.color]||0xb38a5e):0xffe09b;
    const road=mesh(new THREE.BoxGeometry(1.13,.10,owner?.21:.13),makeMat(color),this.board,mid.x,.29,mid.z);
    road.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction);
    if(owner){
      // Short sleeper beams make roads look like deliberate border fortifications.
      for(const n of [-.29,0,.29]){
       const sleeper=mesh(new THREE.BoxGeometry(.07,.075,.27),makeMat(0x7b5941),this.board,mid.x+direction.x*n,.35,mid.z+direction.z*n);
       sleeper.quaternion.copy(road.quaternion);
      }
    }else{road.material.transparent=true;road.material.opacity=.5;}
    if(eligible){
     const plus=textSprite('+','#4a4a38','#fff0b4',.28);plus.position.set(mid.x,.7,mid.z);this.board.add(plus);
     const hitbox=new THREE.Mesh(new THREE.BoxGeometry(1.3,.21,.40),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
     hitbox.position.set(mid.x,.48,mid.z);hitbox.quaternion.copy(road.quaternion);
     hitbox.userData.edge=edge;this.board.add(hitbox);this.pickables.push(hitbox);
    }
   }
  }
 }
 animate(){
  this.onFrame?.(performance.now());
  this.controls.update();
  const now=performance.now(),dt=Math.min(.05,(now-this.lastFrame)/1000);this.lastFrame=now;
  if(this.keys.size){
   const forward=this.camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
   const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
   const x=Number(this.keys.has('d')||this.keys.has('ArrowRight'))-Number(this.keys.has('a')||this.keys.has('ArrowLeft'));
   const z=Number(this.keys.has('w')||this.keys.has('ArrowUp'))-Number(this.keys.has('s')||this.keys.has('ArrowDown'));
   const delta=forward.multiplyScalar(z).addScaledVector(right,x).multiplyScalar(dt*10/this.camera.zoom);
   const target=this.controls.target.clone().add(delta);target.x=THREE.MathUtils.clamp(target.x,-12,12);target.z=THREE.MathUtils.clamp(target.z,-12,12);
   delta.copy(target).sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(target);this.controls.update();
  }
  for(const effect of this.effects){
   const t=Math.min(1,(now-effect.began)/1200);
   effect.mesh.position.copy(effect.start).lerp(effect.end,t);if(effect.moving)effect.mesh.position.y+=Math.sin(t*Math.PI)*.3;
   else effect.mesh.scale.setScalar(1+t*.6);
   if(t===1){this.scene.remove(effect.mesh);effect.mesh.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});}
  }
  this.effects=this.effects.filter(e=>now-e.began<1200);
  this.renderer.render(this.scene,this.camera);
  this.frame=requestAnimationFrame(()=>this.animate());
 }
 destroy(){window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.blur);cancelAnimationFrame(this.frame);this.resizeObs.disconnect();this.controls.dispose();this.renderer.dispose();}
}
