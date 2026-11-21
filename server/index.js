
import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {PROFILES} from '../shared/profiles.js';
import {chooseBotAction} from './bot.js';
import {MAPS} from '../shared/maps.js';
import {randomBytes,randomInt} from 'node:crypto';
import {turnSeconds,settleTurn,generateMap,mapRadius,newRealm,currentDrafter,chooseDraft,perform,finishRoll,forPlayer,adjacent,dist,COLORS} from './realm.js';
const app=express(),server=createServer(app),io=new Server(server,{maxHttpBufferSize:100_000});
const rooms=new Map();
const clean=x=>typeof x==='string'?x.trim().replace(/[<>]/g,'').slice(0,32):'';
const seat=(room,id)=>room.players.find(p=>p.id===id);
const send=room=>{
 for(const client of io.sockets.sockets.values())if(client.data.code===room.code&&seat(room,client.data.id))client.emit('state',forPlayer(room,client.data.id));
};
const code=()=>{let id;do{id=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(id));return id;};
function advance(room){
 if(room.game?.trade){const target=room.players.find(p=>p.id===room.game.trade.to);if(target?.bot){try{perform(room,target.id,{type:room.game.trade.giveCount>=room.game.trade.receiveCount?'acceptTrade':'rejectTrade'});}catch{perform(room,target.id,{type:'rejectTrade'});}}}
 const g=room.game;
 if(g?.pursuit){
  clearTimeout(room.clockTimer);
  const c=g.pursuit,key=c.id+':'+c.step;
  if(!room.responseKey)room.remaining=Math.max(0,g.deadline-Date.now());
  if(room.responseKey!==key){
   clearTimeout(room.responseTimer);room.responseKey=key;c.until=Date.now()+30000;
   room.responseTimer=setTimeout(()=>{
    if(g.pursuit!==c||room.responseKey!==key)return;
    perform(room,c.target,{type:'defend',call:c.id,step:c.step});advance(room);
   },room.players.find(p=>p.id===c.target)?.bot?1000:30000);
  }
  send(room);return;
 }
 if(room.responseKey){
  clearTimeout(room.responseTimer);room.responseKey=null;
  g.deadline=Date.now()+room.remaining;room.clockTimer=setTimeout(()=>advance(room),room.remaining);
 }
 if(g?.phase==='playing'){
  const key=()=>g.round+'-'+g.turn;
  settleTurn(room,room.clockKey===key()&&Date.now()>=g.deadline);
  if(room.clockKey!==key()){
   clearTimeout(room.clockTimer);room.clockKey=key();
   g.deadline=Date.now()+turnSeconds(room)*1000;
   room.clockTimer=setTimeout(()=>advance(room),g.deadline-Date.now());
  }
 }else clearTimeout(room.clockTimer);
 send(room);
 if(room.game?.turnStage==='rolling'){
  if(!room.rollTimer)room.rollTimer=setTimeout(()=>{
   room.rollTimer=null;
   finishRoll(room);advance(room);
  },Math.max(1,room.game.lastRoll.readyAt-Date.now()));
  return;
 }
 scheduleBot(room);
}
function scheduleBot(room){
 const g=room.game;if(!g||room.botBusy)return;
 const id=g.phase==='draft'?currentDrafter(room):g.phase==='playing'?room.players[g.turn].id:null;
 const bot=seat(room,id);if(!bot?.bot)return;
 room.botBusy=true;
 setTimeout(()=>{
  room.botBusy=false;
  const now=room.game;
  if(!now||now.phase==='finished'||now.pursuit)return;
  const id=now.phase==='draft'?currentDrafter(room):room.players[now.turn]?.id;
  if(id!==bot.id)return;
  try{
   if(now.phase==='draft'){
    const value=now.draftStage==='color'?COLORS.find(x=>!room.players.some(p=>p.color===x)):
     [...now.spawnChoices].sort((a,b)=>{
      const score=k=>now.tiles.filter(x=>x.owner).reduce((m,x)=>{
       const [q,r]=k.split(',').map(Number);return Math.min(m,dist({q,r},x));
      },99);
      return score(b)-score(a);
     })[0];
    chooseDraft(room,id,now.draftStage,value);
   }else if(now.phase==='playing'){
    const key=now.round+':'+now.turn;
    if(room.botContext?.key!==key)room.botContext={key,builds:0};
    const action=chooseBotAction(room,room.botContext);room.botContext.steps=(room.botContext.steps||0)+1;
    if(now.trade?.to===id){perform(room,id,{type:'acceptTrade'});advance(room);return;}
    if(action){perform(room,id,action);if(['build','dock','launch'].includes(action.type))room.botContext.builds++;}

   }
  }catch(error){console.error('Bot action:',error.message);try{if(now.phase==='playing'&&now.rolled)perform(room,id,{type:'end'});}catch{}}
  advance(room);
 },Number(process.env.BOT_DELAY_MS)||1600);
}
function refreshPreview(room){
 const radius=mapRadius(room.players.length);
 if(room.previewRadius===radius && room.previewMap===room.mapId)return;
 room.preview=generateMap(room.mapId,radius);room.previewMap=room.mapId;room.previewRadius=radius;
}
app.get('/api/health',(_req,res)=>res.json({ok:true,rooms:rooms.size,app:'riskagon',version:'0.5.0'}));
io.on('connection',socket=>{
 socket.on('room:create',({id,name}={},reply=()=>{})=>{
  id=clean(id);name=clean(name).trim().slice(0,24);
  if(!name)return reply({ok:false,error:'Enter a player name first.'});
  if(id.length<8)return reply({ok:false,error:'Invalid session identity.'});
  const roomCode=code();
  const room={code:roomCode,host:id,players:[{id,name,connected:true,bot:false,color:null,resources:{}}],game:null,botBusy:false};
  room.mapId='frontier';refreshPreview(room);
  rooms.set(roomCode,room);
  socket.data={code:roomCode,id};socket.join(roomCode);
  reply({ok:true,code:roomCode});send(room);
 });
 socket.on('room:join',({code:roomCode,id,name}={},reply=()=>{})=>{
  roomCode=clean(roomCode).toUpperCase();id=clean(id);name=clean(name).trim().slice(0,24);
  if(!name)return reply({ok:false,error:'Enter a player name first.'});
  const room=rooms.get(roomCode);
  if(!room)return reply({ok:false,error:'This realm does not exist or the server restarted.'});
  if(id.length<8)return reply({ok:false,error:'Invalid session identity.'});
  let p=seat(room,id);
  if(!p){
   if(room.game)return reply({ok:false,error:'This match is already underway. Ask for the next game.'});
   if(room.players.length>=COLORS.length)return reply({ok:false,error:'This room is full.'});
   p={id,name,connected:true,bot:false,color:null,resources:{}};
   room.players.push(p);refreshPreview(room);
  }else{p.connected=true;}
  socket.data={code:roomCode,id};socket.join(roomCode);
  reply({ok:true,code:roomCode});advance(room);
 });
 socket.on('room:addBot',(_={},reply=()=>{})=>{
  const room=rooms.get(socket.data.code);
  if(!room||room.host!==socket.data.id)return reply({ok:false,error:'Only the host can invite AI.'});
  if(room.game||room.players.length>=COLORS.length)return reply({ok:false,error:'Game started or room full.'});
  const profiles=Object.keys(PROFILES);
  room.players.push({id:'bot-'+randomBytes(7).toString('hex'),profile:profiles[randomInt(profiles.length)],name:'Kingdom '+(room.players.length+1),color:null,connected:true,bot:true,resources:{}});
  refreshPreview(room);
  reply({ok:true});send(room);
 });
 socket.on('room:map',({mapId}={},reply=()=>{})=>{
  const room=rooms.get(socket.data.code);
  if(!room||room.host!==socket.data.id||room.game||!Object.hasOwn(MAPS,mapId))return reply({ok:false,error:'Map selection is unavailable.'});
  room.mapId=mapId;refreshPreview(room);send(room);reply({ok:true});
 });
 socket.on('room:start',(_={},reply=()=>{})=>{
  const room=rooms.get(socket.data.code);
  if(!room||room.host!==socket.data.id)return reply({ok:false,error:'Only the host can start.'});
  if(room.game||room.players.length<2)return reply({ok:false,error:'Invite at least one other kingdom.'});
  room.game=newRealm(room.players,room.mapId,room.preview);delete room.preview;
  reply({ok:true});advance(room);
 });
 socket.on('draft:pick',({kind,value}={},reply=()=>{})=>{
  const room=rooms.get(socket.data.code);
  if(!room)return reply({ok:false,error:'Join a room first.'});
  try{chooseDraft(room,socket.data.id,kind,value);reply({ok:true});advance(room);}
  catch(e){reply({ok:false,error:e.message});}
 });
 socket.on('game:action',(data={},reply=()=>{})=>{
  const room=rooms.get(socket.data.code);
  if(!room)return reply({ok:false,error:'Join a room first.'});
  if(!room.game?.pursuit&&room.game?.phase==='playing'&&Date.now()>=room.game.deadline){advance(room);return reply({ok:false,error:'Turn time expired.'});}
  try{perform(room,socket.data.id,data);reply({ok:true,roll:room.game.lastRoll,battle:room.game.lastBattle});advance(room);}
  catch(e){reply({ok:false,error:e.message});}
 });
 socket.on('disconnect',()=>{
  const room=rooms.get(socket.data?.code);
  if(!room)return;
  const p=seat(room,socket.data.id);if(p)p.connected=false;
  if(!room.game&&room.host===socket.data.id){
   const next=room.players.find(x=>x.connected&&!x.bot);
   if(next)room.host=next.id;
  }
  send(room);
 });
});
if(process.env.NODE_ENV==='production'){
 const path=await import('node:path');
 app.use(express.static(path.resolve('dist')));
 app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
}else{
 const {createServer:createVite}=await import('vite');
 const vite=await createVite({server:{middlewareMode:true},appType:'spa'});
 app.use(vite.middlewares);
}
const port=process.env.PORT===undefined?3000:Number(process.env.PORT);
server.listen(port,'0.0.0.0',()=>console.log('Riskagon v0.5 at http://localhost:'+server.address().port));
