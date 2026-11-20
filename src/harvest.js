import {Vector3} from 'three';

// The treasury always displays the latest server balance minus rewards still in flight.
export function harvestEffects(board,icons,balance){
 const pending={},notes={wood:196,brick:247,wheat:330,sheep:440,ore:587};
 let audio,epoch=0;
 document.addEventListener('pointerdown',()=>{
  try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}
 },{capture:true});
 function refresh(r){
  const label=document.querySelector('[data-balance="'+r+'"]');
  if(label)label.textContent=Math.max(0,balance(r)-(pending[r]||0));
 }
 function chime(r){
  if(audio?.state!=='running')return;
  const tone=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime;
  tone.type=r==='ore'||r==='brick'?'triangle':'sine';
  tone.frequency.setValueAtTime(notes[r],at);tone.frequency.exponentialRampToValueAtTime(notes[r]*1.5,at+.12);
  gain.gain.setValueAtTime(.045,at);gain.gain.exponentialRampToValueAtTime(.001,at+.15);
  tone.connect(gain).connect(audio.destination);tone.start(at);tone.stop(at+.16);
  tone.onended=()=>{tone.disconnect();gain.disconnect();};
 }
 function particle(r,x,y,dx,dy,delay,duration,arrived){
  const el=document.createElement('span');el.className='harvest-particle';el.textContent=icons[r];el.setAttribute('aria-hidden','true');
  el.style.left=x+'px';el.style.top=y+'px';document.body.append(el);
  const flight=el.animate([{transform:'scale(.5)',opacity:0},{opacity:1,offset:.12},{transform:'translate('+dx+'px,'+dy+'px) scale(.9)',opacity:arrived?1:0}],{duration,delay,fill:'both',easing:'ease-out'});
  flight.onfinish=()=>{el.remove();arrived?.();};
 }
 return {
  refresh(){Object.keys(icons).forEach(refresh);},
  reset(){epoch++;Object.keys(pending).forEach(k=>delete pending[k]);},
  play(harvest){
   const token=epoch,rect=board.renderer.domElement.getBoundingClientRect();let unit=0;
   for(const h of harvest.tiles){
    const t=board.tiles.find(t=>t.id===h.tile);if(!t)continue;
    const v=new Vector3(Math.sqrt(3)*(t.q+t.r/2),.65,1.5*t.r).project(board.camera);
    const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2,r=h.resource;
    if(Math.abs(v.x)<=1&&Math.abs(v.y)<=1)for(let j=0;j<5;j++){
     const a=j*2*Math.PI/5;particle(r,x,y,24*Math.cos(a),24*Math.sin(a)-15,0,540);
    }
    if(!h.count)continue;
    const dest=document.querySelector('[data-balance="'+r+'"]').getBoundingClientRect();
    pending[r]=(pending[r]||0)+h.count;refresh(r);
    for(let i=0;i<h.count;i++)particle(r,x,y,dest.left-x,dest.top-y,250+unit++*85,480,()=>{
     if(token!==epoch)return;
     pending[r]--;refresh(r);chime(r);
    });
   }
  }
 };
}
