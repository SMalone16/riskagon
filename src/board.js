import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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
  this.controls.minZoom=.6;this.controls.maxZoom=3.5;this.controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
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
  this.tiles=[];this.options={};this.hover=null;this.pointerDown=null;
  fetch('/assets/kaykit/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json()})
   .then(()=>{this.kaykit=true;this.update(this.tiles,this.options);}).catch(()=>{});
  this.resizeObs=new ResizeObserver(()=>this.resize());this.resizeObs.observe(container);this.resize();
  this.renderer.domElement.addEventListener('pointerdown',e=>{this.pointerDown={x:e.clientX,y:e.clientY};});
  this.renderer.domElement.addEventListener('pointermove',e=>{
   const hit=this.hit(e);const target=hit?.object?.userData;
   this.renderer.domElement.style.cursor=target?.tile||target?.edge?'pointer':'grab';
  });
  this.renderer.domElement.addEventListener('pointerup',e=>{
    if(!this.pointerDown||Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y)>6)return;
    const hit=this.hit(e);if(!hit)return;
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
   holder.clear();model.scale.setScalar(scale);holder.add(model);
  });
 }
 focus(id){
  const tile=this.tiles.find(t=>t.id===id);if(!tile)return;
  const target=pos(tile);this.controls.target.copy(target);this.camera.position.copy(target).add(new THREE.Vector3(13,19,23));this.camera.zoom=Math.min(2.45,this.camera.zoom*1.7);this.camera.updateProjectionMatrix();this.controls.update();
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
   holder.clear();model.scale.setScalar(scale);
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
  this.board.clear();this.pickables=[];
  const selected=options.selected,roadMode=options.roadMode;
  const tilesById=new Map(tiles.map(t=>[t.id,t]));
  for(const tile of tiles){
   const root=new THREE.Group();root.position.copy(pos(tile));this.board.add(root);
   const colors=TERRAIN[tile.terrain]||TERRAIN.desert;
   const base=mesh(new THREE.CylinderGeometry(1,1,.32,6),[
      makeMat(colors.side),makeMat(colors.top),makeMat(colors.side)
   ],root,0,0,0);
   base.userData.tile=tile.id;this.pickables.push(base);
   const top=new THREE.Group();top.position.y=.17;root.add(top);
   if(selected===tile.id){
    const points=[];
    for(let i=0;i<6;i++){const theta=i*Math.PI/3;points.push(new THREE.Vector3(Math.sin(theta)*1.013,.04,Math.cos(theta)*1.013));}
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffecac}));
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
    if(tile.structures?.length>1){
      const addOn=new THREE.Group();top.add(addOn);
      let n=0;
      for(const kind of tile.structures.filter(x=>x!=='outpost')){
       const angle=(n++)*Math.PI*.57+.7;
       const x=.52*Math.cos(angle),z=.52*Math.sin(angle);
       const structure=new THREE.Group();structure.position.set(x,0,z);structure.scale.setScalar(.47);addOn.add(structure);
       if(kind==='walls'){for(let j=-1;j<=1;j++)box(structure,0xa7aca7,.32,.25,.18,j*.36,.13,0);}
       else if(kind==='farm'||kind==='lumberyard'||kind==='quarry'||kind==='mine'||kind==='ranch'){
        box(structure,0xe8d8ae,.53,.28,.40,0,.15,0);
        cone(structure,kind==='farm'?0xe9c778:color,.42,.30,0,.42,0,4).rotation.y=Math.PI/4;
       }else{
        box(structure,0xded7b7,.5,.43,.42,0,.23,0);
        cone(structure,color,.40,.34,0,.61,0,4).rotation.y=Math.PI/4;
       }
      }
    }
    const army=new THREE.Group();army.position.set(tile.building?.25:0,0,tile.building?.12:0);top.add(army);
    const addSoldier=(name,kind,x,z,height)=>{
     const holder=new THREE.Group();holder.position.set(x,0,z);army.add(holder);
     holder.add(makeTroop(color,kind,height/.95));
     if(kind!=='cavalry')this.attachCharacter(holder,name,color,height);
    };
    addSoldier('Knight','infantry',-.20,-.15,.64);
    if(tile.army>2)addSoldier('Rogue','archer',.16,-.21,.55);
    if(tile.army>5)addSoldier('Barbarian',tile.structures?.includes('stables')?'cavalry':'infantry',-.03,.20,.52);
    const count=textSprite(String(tile.army),'#fff','#273c4a',.35);
    count.position.set(.52,.24,.51);top.add(count);
   }
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
    const eligible=roadMode&&(tile.owner===options.myId||other.owner===options.myId)&&!['lake','river'].includes(tile.terrain)&&!['lake','river'].includes(other.terrain);
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
  this.controls.update();
  this.renderer.render(this.scene,this.camera);
  this.frame=requestAnimationFrame(()=>this.animate());
 }
 destroy(){cancelAnimationFrame(this.frame);this.resizeObs.disconnect();this.controls.dispose();this.renderer.dispose();}
}
