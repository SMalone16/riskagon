
import './style.css';
import {io} from 'socket.io-client';
import {Board} from './board.js';
const socket=io();
const root=document.getElementById('app');
const id=sessionStorage.getItem('riskagon:id')||crypto.randomUUID().slice(0,22);
sessionStorage.setItem('riskagon:id',id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const kinds={forest:'Forest',fields:'Wheat Fields',pasture:'Pasture',hills:'Clay Hills',mountains:'Iron Mountains',desert:'Desert'};
const icons={wood:'🌲',brick:'🧱',wheat:'🌾',sheep:'🐑',ore:'⛏️'};
let code=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
let state=null,selected=null,roadMode=false,marchFrom=null,amount=2;
root.innerHTML=`
<header><div class="logo"><span class="seal">R</span><div><b>RISKAGON</b><small>THE FRONTIER AWAITS</small></div></div><span class="header-caption">HEXAGONAL STRATEGY · MULTIPLAYER</span><div class="header-actions"><span id="online">CONNECTING</span><button id="helpBtn">? RULES</button></div></header>
<main class="layout">
<aside class="left"><div class="eyebrow">THE CONQUEST BEGINS</div><h1>Shape your<br><em>kingdom.</em></h1><p class="sub">Harvest the land. Build your roads. March your armies. Claim the frontier.</p>
<section id="welcome"><div class="eyebrow">YOUR KINGDOM</div><label>Commander name</label><input id="name" maxlength="24" placeholder="Commander" value="Commander"/><button class="primary full" id="create">✦ Create new realm</button><div class="separate">OR JOIN FRIENDS</div><div class="inline"><input id="codeInput" maxlength="6" placeholder="ROOM CODE"/><button id="join">JOIN</button></div><p class="hint">Invite up to 3 friends, or challenge an AI kingdom.</p></section>
<section id="lobby" hidden></section><section id="control" hidden></section>
<div class="footnote">✦ BUILT FOR THE FRONTIER · EARLY ACCESS</div></aside>
<div class="center"><div class="maphead"><div><div class="eyebrow">THE KNOWN WORLD</div><h2 id="mapTitle">A land worth fighting for.</h2></div><div class="round"><span id="round">19 TERRITORIES</span><small id="turn">ROLL · BUILD · CONQUER</small></div></div>
<div class="map"><div id="board"></div><div class="watermark">✦ THE FRONTIER</div><div class="compass">N<br>↑</div><div id="mapGuide">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A HEX</div></div><div class="mapfooter" id="mapFooter">✦ Select any hexagon to inspect its resources.</div></div>
<aside class="right"><section><div class="eyebrow">KINGDOMS OF THE REALM</div><div id="players" class="list"></div></section><section><div class="eyebrow">YOUR TREASURY</div><div id="resources" class="list"></div></section><section><div class="eyebrow">CHRONICLES OF WAR</div><div id="log" class="list"></div></section></aside>
</main><div id="toast" role="status"></div>
<div id="rules" class="rules" hidden><div class="rules-content"><button id="closeRules" class="close">×</button><div class="eyebrow">FIELD MANUAL</div><h2>How to conquer.</h2>
<p>Be the first kingdom to reach <b>13 points.</b> Each territory scores one, a settlement adds one and a fortress adds two.</p>
<p><b>1. Roll:</b> All kingdoms collect from owned tiles matching the dice roll. <b>2. Build:</b> Settlements, fortresses, and roads. Roads go on hex borders, not through their centers.</p>
<p><b>3. Recruit:</b> Spend ore and sheep for 2 troops at a building. <b>4. March:</b> Pick your own hex, click Move / Attack, then an adjacent destination. Always leave a garrison.</p>
<p><b>5. Battle:</b> Risk-style dice resolve attacks; defenders win ties. Roads boost your attacks and make movement cheaper; fortresses improve defense.</p>
<button class="primary full" id="doneRules">RETURN TO GAME</button></div></div>`;
$('#name').value=localStorage.getItem('riskagon:name')||'Commander';
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.className=error?'show error':'show';setTimeout(()=>t.className='',3500);}
const preview=()=>{
 const resources=['forest','pasture','fields','hills','mountains','fields','forest','hills','pasture','desert','mountains','fields','forest','pasture','hills','fields','forest','pasture','mountains'];
 let i=0,tiles=[];for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.abs(q+r)<=2)tiles.push({q,r,id:q+','+r,terrain:resources[i++],number:i===10?null:[3,5,9,4,6,10,11,8,2,0,12,5,6,3,9,10,4,8,11][i-1],owner:null,army:0,building:0});
 return tiles;
};
function me(){return state?.players.find(p=>p.id===id);}
function isActive(){return state?.game?.phase==='playing'&&state.players[state.game.turn]?.id===id;}
function canAct(){return isActive()&&state.game.rolled;}
function act(data){socket.emit('game:action',data,response=>{if(!response?.ok)toast(response?.error||'Action failed',true);});}
function command(event,data,onSuccess){
 socket.emit(event,data,response=>{
  if(!response?.ok){toast(response?.error||'Request failed',true);return;}
  onSuccess?.(response);
 });
}
function displayRoom(codeValue){code=codeValue;history.replaceState(null,'','?room='+code);}
function username(){const name=$('#name').value.trim().slice(0,24)||'Commander';localStorage.setItem('riskagon:name',name);return name;}
function joinRoom(value){command('room:join',{code:value.trim().toUpperCase(),id,name:username()},r=>{displayRoom(r.code);toast('Joined realm '+r.code);});}
const board=new Board($('#board'),tile=>{
 if(!state?.game||state.game.phase==='finished')return;
 if(marchFrom){
  if(tile===marchFrom){marchFrom=null;render();return;}
  const source=state.game.tiles.find(t=>t.id===marchFrom);
  act({type:'march',from:marchFrom,to:tile,amount:Math.min(Math.max(1,amount),source.army-1)});
  marchFrom=null;selected=tile;render();return;
 }
 selected=tile;roadMode=false;render();
},edge=>{if(roadMode)act({type:'road',edge});});
board.update(preview(),{});
function canPay(type){
 const costs={settlement:{wood:1,brick:1,wheat:1,sheep:1},fort:{ore:2,brick:1,wheat:1},recruit:{ore:1,sheep:1},road:{wood:1,brick:1}};
 return Object.entries(costs[type]).every(([key,n])=>(me()?.resources[key]||0)>=n);
}
function btn(text,action,enabled=true,cls=''){return `<button data-action="${action}" class="${cls}" ${enabled?'':'disabled'}>${text}</button>`;}
function render(){
 const g=state?.game;
 $('#welcome').hidden=!!state;$('#lobby').hidden=!state||!!g;$('#control').hidden=!g;
 $('#mapTitle').textContent=g?(g.phase==='finished'?'A kingdom has risen.':'The war for the frontier.'):(state?'Gather your kingdoms.':'A land worth fighting for.');
 $('#round').textContent=g?'ROUND '+g.round:'19 TERRITORIES';
 $('#turn').textContent=g?(g.phase==='finished'?'CONQUEST COMPLETE':isActive()?'YOUR TURN':'WAITING FOR '+state.players[g.turn].name.toUpperCase()):'ROLL · BUILD · CONQUER';
 $('#mapGuide').textContent=roadMode?'CLICK AN EDGE TO BUILD A ROAD':marchFrom?'CLICK AN ADJACENT HEX TO MARCH':'DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A HEX';
 if(state&&!g){
  $('#lobby').innerHTML=`<div class="eyebrow">YOUR PRIVATE REALM</div><div class="room-code">${safe(state.code)}</div><p class="hint">Share this code with your friends.</p>${btn('↗ Copy invite link','copy',true,'secondary full')}<div class="eyebrow spaced">COMMANDERS · ${state.players.length}/4</div>${state.players.map(p=>`<div class="lobby-player"><i class="color ${p.color}"></i>${safe(p.name)} ${p.bot?'[AI]':''} ${p.id===state.host?'[HOST]':''}</div>`).join('')}${state.host===id?btn('+ Add AI kingdom','bot',state.players.length<4,'secondary full')+btn('⚔ Begin conquest','start',state.players.length>=2,'primary full'):'<p class="hint">Waiting for the host to begin.</p>'}`;
 }
 if(g){
  const tile=g.tiles.find(t=>t.id===selected),own=tile?.owner===id;
  const max=own?Math.max(1,tile.army-1):1;amount=Math.min(amount,max);
  const winner=state.players.find(p=>p.id===g.winner);
  $('#control').innerHTML=`<div class="eyebrow">ROUND ${g.round} · COMMANDER ${g.turn+1}</div><div class="current-player"><span>♜</span><div><small>CURRENT TURN</small><b>${safe(state.players[g.turn].name)}</b></div></div>${g.phase==='finished'?'<div class="victory">✦ '+safe(winner?.name)+' wins the realm!</div>':`
  ${btn(g.rolled?'⚄ Rolled '+g.lastRoll:'⚄ Roll to harvest','roll',isActive()&&!g.rolled,'primary full')}
  <div class="mobility">MOBILITY LEFT <b>${(2-g.mobilityUsed).toFixed(1)} / 2</b></div>
  <div class="eyebrow spaced">SELECTED TERRITORY</div><div class="selected">${tile?'<b>'+kinds[tile.terrain]+'</b><p>Roll '+(tile.number||'—')+' · '+(tile.owner?state.players.find(x=>x.id===tile.owner)?.name:'Unclaimed')+'<br>'+tile.army+' soldiers · '+(['No structure','Settlement','Fortress'][tile.building])+'</p>':'<p>Click a hexagon to inspect it.</p>'}</div>
  <div class="eyebrow spaced">DEVELOP & EXPAND</div><div class="action-grid">${btn('⌂ Settlement','settlement',canAct()&&own&&tile.building===0&&canPay('settlement'))}${btn('♜ Fortress','fort',canAct()&&own&&tile.building===1&&canPay('fort'))}${btn('⚔ Recruit +2','recruit',canAct()&&own&&tile.building>0&&canPay('recruit'))}${btn('═ Road mode','road',canAct()&&canPay('road'),roadMode?'chosen':'')}</div>
  <div class="eyebrow spaced">MILITARY ORDERS</div><div class="march-controls"><label for="amount">Troops to march</label><input id="amount" type="number" min="1" max="${max}" value="${amount}"/></div>${btn(marchFrom?'× Cancel march':'⚔ Move / Attack','march',canAct()&&own&&tile.army>1&&g.mobilityUsed<2,'secondary full')}
  <p class="hint">${marchFrom?'Choose an adjacent destination.':'Roads halve movement cost on connected edges.'}</p>${btn('End turn →','end',isActive()&&g.rolled,'endturn full')}
  `}`;
  board.update(g.tiles,{selected,roadMode,roads:g.roads,players:state.players});
  $('#mapFooter').textContent=tile?kinds[tile.terrain]+' · '+tile.army+' troops · '+(tile.owner?state.players.find(p=>p.id===tile.owner)?.name:'Unclaimed'):'✦ Choose a tile to inspect the frontier.';
 }else{board.update(preview(),{});$('#mapFooter').textContent='✦ A new realm of 19 hexagons awaits.';}
 $('#players').innerHTML=state?.players.map(p=>{
  const owned=g?.tiles.filter(t=>t.owner===p.id)||[];
  const vp=owned.reduce((n,t)=>n+1+t.building,0);
  return `<div class="player ${p.id===id?'self':''}"><span class="avatar ${p.color}">${safe(p.name[0])}</span><div><b>${safe(p.name)} ${p.id===id?'· YOU':''}</b><small>${g?owned.length+' territories · '+owned.reduce((n,t)=>n+t.army,0)+' soldiers':p.bot?'AI Kingdom':'Ready to play'}</small></div><strong>${g?vp+' VP':'—'}</strong></div>`;
 }).join('')||'<p class="hint">Your rival kingdoms will appear here.</p>';
 $('#resources').innerHTML=g&&me()?Object.entries(icons).map(([k,ico])=>`<div class="resource"><span>${ico}</span><label>${k[0].toUpperCase()+k.slice(1)}</label><b>${me().resources[k]||0}</b></div>`).join(''):'<p class="hint">The treasury opens when the game begins.</p>';
 $('#log').innerHTML=g?.log.slice(0,8).map(line=>`<div class="log"><span>✦</span>${safe(line)}</div>`).join('')||'<p class="hint">The chronicles await their first story.</p>';
}
$('#create').onclick=()=>command('room:create',{id,name:username()},r=>{displayRoom(r.code);toast('Realm created. Invite your friends!');});
$('#join').onclick=()=>joinRoom($('#codeInput').value);
$('#codeInput').onkeydown=e=>{if(e.key==='Enter')joinRoom(e.target.value);};
root.addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(!action)return;
 if(action==='copy'){try{await navigator.clipboard.writeText(location.href);toast('Invitation copied!');}catch{toast(location.href);}return;}
 if(action==='bot'||action==='start'){command('room:'+(action==='bot'?'addBot':'start'),{},()=>toast(action==='bot'?'AI kingdom joined.':'Conquest begins!'));return;}
 if(action==='road'){roadMode=!roadMode;marchFrom=null;render();return;}
 if(action==='march'){marchFrom=marchFrom?null:selected;roadMode=false;render();return;}
 if(action==='end'||action==='roll'){act({type:action});return;}
 if(['settlement','fort','recruit'].includes(action)){act({type:action,tile:selected});}
});
root.addEventListener('change',e=>{if(e.target.id==='amount')amount=Math.max(1,Math.floor(Number(e.target.value)||1));});
const toggleHelp=()=>{$('#rules').hidden=!$('#rules').hidden;};
$('#helpBtn').onclick=toggleHelp;$('#closeRules').onclick=toggleHelp;$('#doneRules').onclick=toggleHelp;
socket.on('connect',()=>{
 $('#online').textContent='● CONNECTED';$('#online').className='connected';
 if(code)socket.emit('room:join',{code,id,name:localStorage.getItem('riskagon:name')||'Commander'},r=>{
  if(!r?.ok){toast(r?.error||'Could not join room.',true);code='';history.replaceState(null,'',location.pathname);}
 });
});
socket.on('disconnect',()=>{$('#online').textContent='● RECONNECTING';$('#online').className='';});
socket.on('state',next=>{state=next;if(code!==state.code)displayRoom(state.code);render();});
render();
