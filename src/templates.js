import {makeGardenProp,gardenPacks} from './garden.js';
import {project,makeScene,initializeScene,entity,createRule} from './model.js';

/** Every template is an explicitly labeled original sample; empty projects stay empty. */
export function templateProject(type='platformer') {
 const p=project(true);p.name=type==='platformer'?'Moonfern · Sample':type==='topdown'?'Understone · Sample':type==='2.5d'?'Willowmere · Water World':'Nightwire · Sample';
 if(type==='platformer')return p;
 if(type==='2.5d'){
  const s=initializeScene(makeScene('Willowmere · Lotus gardens'));s.width=32;s.height=36;s.gameType='2.5d';s.biome='watergarden';s.camera={x:0,y:160,w:480,h:320};
  s.garden={water:'#419baa',light:'#82d2cb',deep:'#267284',animate:true,packId:'watergarden'};
  const terrain=s.layers.find(l=>l.id==='terrain').tiles;
  const paint=(x0,y0,x1,y1,id=19)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)terrain[x+','+y]=id;};
  paint(1,1,13,3);paint(1,4,3,14);paint(26,0,29,14);paint(1,13,11,15);paint(20,13,29,15);
  paint(26,16,29,25);paint(10,23,13,35);paint(18,29,29,31);paint(26,26,29,35);paint(3,7,6,9);paint(21,20,24,22);
  for(let y=25;y<=32;y++)for(let x=2;x<=9;x++)if(((x-5.5)/4)**2+((y-28.5)/4.4)**2<1)terrain[x+','+y]=20;
  paint(6,24,10,25,21);paint(10,20,13,23,21);
  const props=[['bridge',176,200],['fountain',128,288],['fountain',336,288],['fountain',336,64],['basin',-24,288],['palm',64,464],['palm',96,432],['reeds',64,304],['reeds',320,72],['reeds',376,448],['lotus',190,305],['lotus',286,311],['lotus',98,496],['lotus',63,448],['lily',58,84],['lily',260,398],['lily',358,408],['lily',162,530],['rock',45,514],['reeds',400,536]];
  s.entities=props.map(([kind,x,y])=>{const e=makeGardenProp(kind,x,y);e.packId='watergarden';return e;});
  for(const [x,y]of [[92,179],[136,174],[313,157],[371,180],[155,345],[179,369],[276,342],[440,373],[51,405],[193,128],[332,449]]){const e=makeGardenProp('lily',x,y);e.w=14;e.h=9;e.packId='watergarden';s.entities.push(e);}
  const player=entity('player',64,216);player.speed=95;
  const npc=entity('npc',350,219);npc.text='Welcome to Lotus Gardens. Cross the limestone bridge and follow the boardwalk.';npc.behavior='stationary';
  s.entities.push(player,npc,entity('gem',235,224),entity('checkpoint',430,232),entity('door',442,510));
  s.hud.objective='Cross the bridge and follow the boardwalk to the garden gate.';p.name='Willowmere · Garden sample';p.scenes=[s];return p;
 }
 if(type==='platformer')return p;

 if(type==='2.5d'){
  const s=initializeScene(makeScene('Willowmere · Lotus gardens'));s.width=32;s.height=36;s.gameType='2.5d';s.biome='watergarden';s.camera={x:0,y:160,w:480,h:320};
  s.garden={water:'#419baa',light:'#82d2cb',deep:'#267284',animate:true,packId:'watergarden'};
  const terrain=s.layers.find(l=>l.id==='terrain').tiles;
  const paint=(x0,y0,x1,y1,id=19)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)terrain[x+','+y]=id;};
  paint(1,1,13,3);paint(1,4,3,14);paint(26,0,29,14);paint(1,13,11,15);paint(20,13,29,15);
  paint(26,16,29,25);paint(10,23,13,35);paint(18,29,29,31);paint(26,26,29,35);paint(3,7,6,9);paint(21,20,24,22);
  for(let y=25;y<=32;y++)for(let x=2;x<=9;x++)if(((x-5.5)/4)**2+((y-28.5)/4.4)**2<1)terrain[x+','+y]=20;
  paint(6,24,10,25,21);paint(10,20,13,23,21);
  const props=[['bridge',176,200],['fountain',128,288],['fountain',336,288],['fountain',336,64],['basin',-24,288],['palm',64,464],['palm',96,432],['reeds',64,304],['reeds',320,72],['reeds',376,448],['lotus',190,305],['lotus',286,311],['lotus',98,496],['lotus',63,448],['lily',58,84],['lily',260,398],['lily',358,408],['lily',162,530],['rock',45,514],['reeds',400,536]];
  s.entities=props.map(([kind,x,y])=>{const e=makeGardenProp(kind,x,y);e.packId='watergarden';return e;});
  for(const [x,y]of [[92,179],[136,174],[313,157],[371,180],[155,345],[179,369],[276,342],[440,373],[51,405],[193,128],[332,449]]){const e=makeGardenProp('lily',x,y);e.w=14;e.h=9;e.packId='watergarden';s.entities.push(e);}
  const player=entity('player',64,216);player.speed=95;
  const npc=entity('npc',350,219);npc.text='Welcome to Lotus Gardens. Cross the limestone bridge and follow the boardwalk.';npc.behavior='stationary';
  s.entities.push(player,npc,entity('gem',235,224),entity('checkpoint',430,232),entity('door',442,510));
  s.hud.objective='Cross the bridge and follow the boardwalk to the garden gate.';p.name='Willowmere · Garden sample';p.scenes=[s];return p;
 }

 if(type==='topdown'){
  const s=initializeScene(makeScene('Understone · Lantern Vault'));
  s.width=40;s.height=28;s.gameType='topdown';s.biome='temple';s.camera={x:0,y:0,w:480,h:320};
  const terrain=s.layers.find(l=>l.id==='terrain').tiles,details=s.layers.find(l=>l.id==='details').tiles;
  for(let x=0;x<s.width;x++)for(let y=0;y<s.height;y++){
   if(x===0||y===0||x===s.width-1||y===s.height-1)terrain[x+','+y]=3;
   if((x===12||x===27)&&(y<8||y>19))terrain[x+','+y]=3;
   if((y===9||y===18)&&(x<8||x>31))terrain[x+','+y]=3;
   if((x%5===0&&y%4===0)&&(x>2&&x<37&&y>2&&y<25))details[x+','+y]=8;
  }
  // Deliberately top-down: open chambers, no platformer-style floor bands.
  for(const [x,y] of [[5,5],[7,21],[17,6],[22,13],[31,5],[34,21]])details[x+','+y]=10;
  const player=entity('player',96,96);player.speed=120;
  const key=entity('key',144,320);key.keyId='vault-key';
  const switchEntity=entity('switch',352,208);
  const door=entity('door',560,192);door.locked=true;door.keyId='vault-key';
  const npc=entity('npc',240,352);npc.text='The lantern vault is sealed. Find the key or trigger the ancient switch.';
  const gem1=entity('gem',272,128),gem2=entity('gem',400,320),enemy=entity('enemy',448,112);enemy.behavior='patrol';enemy.patrol=160;
  s.entities=[player,key,switchEntity,door,npc,gem1,gem2,enemy];
  const rule=createRule();Object.assign(rule,{name:'Switch opens the vault',event:'switch',sourceId:switchEntity.id,action:'open',targetId:door.id});s.events.push(rule);
  s.hud.objective='Explore the vault, find the key, and open the sealed gate.';
  p.name='Understone · Lantern Vault';p.scenes=[s];return p;
 }

 if(type==='arcade'){
  const s=initializeScene(makeScene('Nightwire · Arcade Run'));
  s.width=64;s.height=20;s.gameType='arcade';s.biome='city';s.camera={x:0,y:0,w:640,h:320};
  const terrain=s.layers.find(l=>l.id==='terrain').tiles,details=s.layers.find(l=>l.id==='details').tiles;
  // Distinct arcade layout: long horizontal lanes and staggered platforms.
  for(let x=0;x<s.width;x++){
   for(let y=17;y<20;y++)terrain[x+','+y]=y===17?1:3;
   if(x<10||x>54)terrain[x+',16']=3;
   if(x>=14&&x<=24)for(let y=12;y<=13;y++)terrain[x+','+y]=3;
   if(x>=29&&x<=38)for(let y=9;y<=10;y++)terrain[x+','+y]=3;
   if(x>=43&&x<=51)for(let y=12;y<=13;y++)terrain[x+','+y]=3;
  }
  for(const [x,y] of [[8,15],[18,11],[25,16],[33,8],[40,16],[47,11],[55,15]])details[x+','+y]=8;
  const player=entity('player',48,224);player.speed=145;player.jump=520;
  const enemies=[entity('enemy',224,192),entity('enemy',464,192),entity('enemy',688,192)];
  enemies[0].behavior='patrol';enemies[0].patrol=120;
  enemies[1].behavior='chasing';enemies[2].behavior='projectile';
  const emitter=entity('emitter',856,176);emitter.period=1.2;
  const hazard=entity('hazard',368,260);hazard.damage=1;
  const checkpoint=entity('checkpoint',752,208);
  const exit=entity('door',976,192);exit.locked=false;
  const gems=[entity('gem',304,160),entity('gem',496,112),entity('gem',688,160),entity('gem',864,240)];
  s.entities=[player,...enemies,emitter,hazard,checkpoint,exit,...gems];
  s.hud.objective='Survive the run, collect the sparks, and reach the exit.';
  p.name='Nightwire · Arcade Run';p.scenes=[s];return p;
 }

 throw new Error('Unknown template type: '+type);}

export function packExampleProject(id='watergarden'){
 const pack=gardenPacks[id]||gardenPacks.watergarden,p=templateProject('2.5d'),s=p.scenes[0];
 s.biome=id;s.garden={...s.garden,packId:id};
 s.name=pack.name+' sample';p.name=pack.name+' sample';
 const seed=[...id].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,7);
 const bridgeLayouts=[[176,200],[96,256],[272,176],[192,304],[80,192],[240,240],[144,160],[288,288],[176,144],[96,320],[256,208]];
 const [bridgeX,bridgeY]=bridgeLayouts[seed%bridgeLayouts.length];
 let propIndex=0;
 for(const e of s.entities)if(e.type==='prop'){
  e.packId=id;
  if(e.propKind==='bridge'){e.x=bridgeX;e.y=bridgeY;continue;}
  e.x=Math.max(-24,Math.min(s.width*16-e.w,e.x+((seed>>3)%7-3)*16+(propIndex%3)*8));
  e.y=Math.max(0,Math.min(s.height*16-e.h,e.y+((seed>>6)%9-4)*16+(propIndex%2)*16));propIndex++;
 }
 const landmarks=pack.landmarks||[pack.landmark];
 landmarks.forEach((kind,index)=>{const e=makeGardenProp(kind,72+((seed+index*137)%22)*16,96+((seed+index*83)%22)*16);e.packId=id;s.entities.push(e);});
 s.hud.objective='Explore the '+pack.name+' example and make it your own.';
 return p;
}
