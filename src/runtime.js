import {clone,collisionAt,palettes} from './model.js';
import {drawScene} from './render.js';

// No new module dependency: the HTML exporter strips these top-level imports.
const runtimeOverlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const runtimeNumber=(v,f)=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):f;
const runtimeHostile=e=>e.type==='enemy'||e.type==='boss';
const runtimeOverhead=new Set(['topdown','2.5d','arcade','beat-em-up','dungeon','boss-arena']);

export class Runtime {
  constructor(scene,projectData) {
    this.project=projectData?clone(projectData):undefined;
    this.score=0;this.elapsed=0;this.deaths=0;this.lives=3;this.keys=new Set();this.inventory={};
    this.paused=false;this.won=false;this.accumulator=0;this.sequence=0;this.eventDepth=0;
    this.notifications=[];this.emit=null;this.audio=null;this.audioReady=false;this.currentMusic=null;this.activeAudio=new Set();this.muted=false;this.sceneStates=new Map();this.checkpointState=null;this.checkpointScore=this.score;this.checkpointInventory={};this.checkpointKeys=[];this.loadScene(clone(scene),false);
  }
  prepareEntity(e) {
    e.w=runtimeNumber(e.w,12);e.h=runtimeNumber(e.h,16);e.speed=runtimeNumber(e.speed,e.type==='player'?145:35);
    e.health=runtimeNumber(e.health,e.type==='boss'?12:1);e.maxHealth??=e.health;e.damage=runtimeNumber(e.damage,1);
    e.origin=e.x;e.originY=e.y;e.dir=['left','up',-1].includes(e.direction)?-1:1;
    e.vy=0;e.age=0;e.cooldown=0;e.pathIndex=0;return e;
  }
  loadScene(scene,preserve=true) {
    const p=scene.entities.find(e=>e.type==='player');
    if(!p)throw Error('Place a player spawn from the Entities tab before playtesting.');
    this.scene=scene;scene.collision??={};scene.events??=[];scene.camera??={w:384,h:216};scene.layers??=[];
    scene.entities.forEach(e=>this.prepareEntity(e));this.player=p;this.spawn={x:p.x,y:p.y};this.maxHealth=p.health;
    this.health=preserve?Math.min(this.health,this.maxHealth):this.maxHealth;this.overhead=runtimeOverhead.has(scene.gameType);
    this.vx=0;this.vy=0;this.grounded=false;this.coyote=0;this.buffer=0;this.previousJump=false;this.previousInteract=false;
    this.invincible=0;this.attack=0;this.attackCooldown=0;this.facing=1;this.aim={x:1,y:0};
    this.contacts=new Set();this.attackHits=new Set();this.sceneTime=0;this.pending=[];this.fired=new Set();this.timerNext=new Map();
    this.cameraTarget=null;this.shake=0;this.dialogue=null;this.message=null;this.boss=null;this.entryPending=true;this.won=false;
    if(this.audioReady)this.playSceneMusic();
    this.hazards=scene.layers.flatMap(l=>Object.entries(l.tiles||{}).filter(([,id])=>id===5||id===16).map(([key])=>{
      const [x,y]=key.split(',').map(Number);return{x:x*16,y:y*16+5,w:16,h:11};
    }));
  }
  audioAssets(){return [...(this.project?.audio?.effects||[]),...(this.project?.audio?.music||[])];}
  findAudio(value){
    if(!value)return null;
    const id=String(value).trim().toLowerCase();
    return this.audioAssets().find(a=>String(a.id).toLowerCase()===id||String(a.name).toLowerCase()===id)||null;
  }
  async unlockAudio(){
    // HTMLAudioElement is the actual playback path. Start scene music from the
    // user gesture before awaiting AudioContext.resume(), otherwise browsers
    // can reject playback as autoplay because the gesture has been consumed.
    this.audioReady=true;
    const sceneMusic=this.sceneMusicAsset();
    if(sceneMusic)this.playAudio(sceneMusic.id);
    const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Ctx)return true;
    try{
      if(!this.audio)this.audio=new Ctx();
      if(this.audio.state==='suspended')await this.audio.resume();
    }catch{
      // AudioContext is only an unlock helper; HTMLAudio playback can still work.
    }
    return true;
  }
  setMuted(value){this.muted=Boolean(value);if(this.currentMusic)this.currentMusic.muted=this.muted;for(const player of this.activeAudio)player.muted=this.muted;}
  async playAudio(value){
    const asset=this.findAudio(value);
    if(!asset||this.project?.settings?.sound===false)return false;
    let player=null;
    try{
      if(!this.audioReady)await this.unlockAudio();
      player=new Audio(asset.data);
      player.preload='auto';
      player.volume=Math.max(0,Math.min(1,runtimeNumber(this.project?.settings?.volume,.25)));player.muted=this.muted;
      player.loop=Boolean(asset.loop);
      this.activeAudio.add(player);
      player.onended=()=>{this.activeAudio.delete(player);if(this.currentMusic===player)this.currentMusic=null;try{player.src='';}catch{}};
      if(asset.loop){
        if(this.currentMusic&&this.currentMusic!==player){this.currentMusic.pause();this.currentMusic.currentTime=0;this.activeAudio.delete(this.currentMusic);this.currentMusic.src='';}
        this.currentMusic=player;
      }
      await player.play();
      return true;
    }catch{if(player){this.activeAudio.delete(player);if(this.currentMusic===player)this.currentMusic=null;try{player.pause();player.src='';}catch{}}this.notify('audio-error',{sound:value});return false;}
  }
  stopMusic(){if(this.currentMusic){this.currentMusic.pause();this.currentMusic.currentTime=0;this.activeAudio.delete(this.currentMusic);this.currentMusic.src='';this.currentMusic=null;}}
  stopAllAudio(){for(const player of this.activeAudio){try{player.pause();player.currentTime=0;player.src='';}catch{}}this.activeAudio.clear();this.currentMusic=null;}
  dispose(){this.stopAllAudio();try{this.audio?.close?.()}catch{}this.audio=null;this.audioReady=false;}
  async resumeAudio(){if(this.audio?.state==='suspended'){try{await this.audio.resume()}catch{}}}
  sceneMusicAsset(){
    const id=String(this.scene?.musicId||'').trim();
    return id?((this.project?.audio?.music||[]).find(a=>a.id===id)||null):null;
  }
  playSceneMusic(){
    const asset=this.sceneMusicAsset();
    if(asset)return this.playAudio(asset.id);
    this.stopMusic();
    return false;
  }
  notify(type,detail={}) {
    const event={type,...detail};this.notifications.push(event);if(this.notifications.length>100)this.notifications.shift();
    if(typeof this.emit==='function')this.emit(event);
  }
  // Public hook. Rule delays and optional timer periods are measured in seconds.
  dispatch(event,sourceId='*',detail={}) {
    if(this.eventDepth>=24)return;
    this.eventDepth++;const scene=this.scene;
    try{for(const [index,rule]of scene.events.entries()){
      const id=rule.id||`rule-${index}`;
      if(rule.enabled===false||rule.event!==event||this.fired.has(id))continue;
      if(rule.sourceId&&rule.sourceId!=='*'&&rule.sourceId!==sourceId)continue;
      this.scheduleRule(rule,id,detail);if(this.scene!==scene)break;
    }}finally{this.eventDepth--;}
  }
  scheduleRule(rule,id,detail={}) {
    if(rule.once!==false)this.fired.add(id);
    const delay=Math.max(0,runtimeNumber(rule.delay,0));
    if(delay)this.pending.push({at:this.sceneTime+delay,rule:clone(rule),detail});else this.runAction(rule,detail);
  }
  value(value) {if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return value;}}
  runAction(rule,detail={}) {
    const value=this.value(rule.value),target=this.scene.entities.find(e=>e.id===rule.targetId);
    switch(rule.action){
      case 'open':if(target){target.locked=false;target.open=true;}break;
      case 'close':if(target){target.locked=true;target.open=false;}break;
      case 'destroy':if(target&&target!==this.player)this.defeat(target);break;
      case 'spawn':{
        const template=value&&typeof value==='object'?value:target;
        if(template){const e=this.prepareEntity(clone(template));e.id=`${e.id||'spawn'}-${++this.sequence}`;e.dead=false;e.visible=true;this.scene.entities.push(e);}break;
      }
      case 'dialogue':this.dialogue={text:String(value||target?.text||''),sourceId:target?.id||rule.targetId};this.notify('dialogue',this.dialogue);break;
      case 'message':this.message={text:String(value??''),until:this.sceneTime+4};this.notify('message',this.message);break;
      case 'camera':this.cameraTarget=target?.id||(value&&typeof value==='object'?value:null);break;
      case 'sound':this.notify('sound',{sound:value,sourceId:rule.targetId});this.playAudio(value);break;
      case 'shake':this.shake=Math.max(0,runtimeNumber(value,.4));break;
      case 'palette':if(Object.hasOwn(palettes,value))this.scene.biome=value;break;
      case 'animation':if(target){target.animation=value;target.animationTime=this.elapsed;if(value==='hide')target.visible=false;if(value==='show')target.visible=true;if(value==='flip')target.flipX=!target.flipX;}break;
      case 'item':{
        const item=value&&typeof value==='object'?value:{id:rule.targetId||String(value),amount:1},amount=runtimeNumber(item.amount,1);
        if(item.id==='health')this.health=Math.max(0,Math.min(this.maxHealth,this.health+amount));
        else if(item.id==='score')this.score+=amount;else if(item.id==='lives')this.lives=Math.max(0,this.lives+amount);
        else if(item.id){this.inventory[item.id]=(this.inventory[item.id]||0)+amount;if(this.inventory[item.id]>0)this.keys.add(item.id);else this.keys.delete(item.id);}break;
      }
      case 'scene':this.transition(String(value||rule.targetId||''));break;
      case 'checkpoint':this.setCheckpoint(target||this.player);break;
      case 'boss':if(target){target.active=true;target.behavior='boss';this.boss=target;this.dispatch('boss',target.id);}break;
    }
  }
  transition(id) {
    if(!id){this.complete();return true;}
    const template=this.project?.scenes?.find(s=>s.id===id);
    if(!template||!template.entities.some(e=>e.type==='player')){this.notify('message',{text:`Scene unavailable or missing player spawn: ${id}`});return false;}
    this.sceneStates.set(this.scene.id,clone(this.scene));const next=clone(this.sceneStates.get(id)||template);this.loadScene(next);this.checkpointState=clone(next);this.checkpointScore=this.score;this.checkpointInventory=clone(this.inventory);this.checkpointKeys=[...this.keys];
    this.notify('scene',{sceneId:id});return true;
  }
  complete() {const scene=this.scene;this.dispatch('complete',scene.id);if(this.scene===scene){this.won=true;this.notify('complete',{sceneId:scene.id});}}
  setCheckpoint(e) {
    this.spawn={x:e.x,y:e.y};
    const activate=e.type==='player'||!e.active;
    if(e.type!=='player'&&!e.active){e.active=true;this.dispatch('checkpoint',e.id);this.notify('checkpoint',{sceneId:this.scene.id,x:e.x,y:e.y});}
    if(!activate)return;
    this.checkpointState=clone(this.scene);this.sceneStates.set(this.scene.id,clone(this.scene));
    this.checkpointScore=this.score;this.checkpointInventory=clone(this.inventory);this.checkpointKeys=[...this.keys];
  }
  respawn() {
    const scene=this.scene;this.deaths++;this.lives=Math.max(0,this.lives-1);this.dispatch('death',this.player.id);if(this.scene!==scene)return;
    const snapshot=this.checkpointState?clone(this.checkpointState):null;
    if(snapshot){this.loadScene(snapshot,false);this.score=this.checkpointScore??this.score;this.inventory=clone(this.checkpointInventory||this.inventory);this.keys=new Set(this.checkpointKeys||[...this.keys]);}
    this.player.x=this.spawn.x;this.player.y=this.spawn.y;this.health=this.maxHealth;this.vx=0;this.vy=0;this.invincible=1.5;this.contacts.clear();
    this.notify('death',{deaths:this.deaths,lives:this.lives});
  }
  hit(damage=1) {if(this.invincible>0)return;this.health-=Math.max(0,runtimeNumber(damage,1));this.invincible=1;if(!this.overhead)this.vy=-150;this.shake=.15;this.notify('sound',{sound:'hurt'});if(this.health<=0)this.respawn();}
  defeat(e) {if(e.dead)return;e.dead=true;if(runtimeHostile(e))this.score+=e.type==='boss'?1000:100;this.dispatch('defeat',e.id);if(e.type==='boss'){this.dispatch('boss',e.id,{defeated:true});this.notify('boss',{id:e.id,defeated:true});}}
  damageEntity(e,damage=1) {
    if(e.dead)return;
    if(e.behavior==='shielded'&&Math.sign(this.player.x-e.x)===e.dir){this.notify('sound',{sound:'shield'});return;}
    e.health-=damage;e.flash=.12;if(e.health<=0)this.defeat(e);
  }
  solid(x,y,prevBottom,vertical) {const t=collisionAt(this.scene,x,y);return t===4?this.overhead||(vertical&&this.vy>=0&&prevBottom<=y*16+1):t>0;}
  // Small axis sweeps also protect fast bodies against tunnelling through thin walls.
  moveBody(body,dx,dy,{oneWay=!this.overhead,entities=true}={}) {
    let grounded=false,blockedX=false,blockedY=false;
    const blockers=entities?this.scene.entities.filter(e=>e!==body&&!e.dead&&((e.type==='prop'&&e.solid&&e.visible!==false)||e.type==='platform'||e.type==='breakable'||(['door','transition'].includes(e.type)&&e.locked&&!e.open))):[];
    for(const axis of ['x','y']){
      const amount=axis==='x'?dx:dy,count=Math.max(1,Math.ceil(Math.abs(amount)/4)),step=amount/count;
      for(let i=0;i<count;i++){
        const bottom=body.y+body.h;body[axis]+=step;let blocked=false;
        for(let y=Math.floor(body.y/16);y<=Math.floor((body.y+body.h-.001)/16);y++)for(let x=Math.floor(body.x/16);x<=Math.floor((body.x+body.w-.001)/16);x++){
          const tile=collisionAt(this.scene,x,y);
          if(!tile||(tile===4&&oneWay&&!(axis==='y'&&step>=0&&bottom<=y*16+.01)))continue;
          if(step>0)body[axis]=(axis==='x'?x:y)*16-(axis==='x'?body.w:body.h);else if(step<0)body[axis]=((axis==='x'?x:y)+1)*16;else continue;
          blocked=true;
        }
        for(const e of blockers){
          if(!runtimeOverlap(body,e))continue;if(e.type==='platform'&&oneWay&&!(axis==='y'&&step>=0&&bottom<=e.y+.01))continue;
          if(step>0)body[axis]=e[axis]-(axis==='x'?body.w:body.h);else if(step<0)body[axis]=e[axis]+(axis==='x'?e.w:e.h);else continue;blocked=true;
        }
        if(axis==='x')body.x=Math.max(0,Math.min(this.scene.width*16-body.w,body.x));
        if(this.overhead&&axis==='y')body.y=Math.max(0,Math.min(this.scene.height*16-body.h,body.y));
        if(blocked){if(axis==='x')blockedX=true;else{blockedY=true;if(step>0)grounded=true;}break;}
      }
    }
    return{grounded,blockedX,blockedY};
  }
  move(dt) {const result=this.moveBody(this.player,this.vx*dt,this.vy*dt);this.grounded=result.grounded;if(result.blockedX)this.vx=0;if(result.blockedY)this.vy=0;}
  input(keys) {
    const has=(...names)=>names.some(k=>keys.has(k)),gp=globalThis.navigator?.getGamepads?.()?.[0];
    let x=Number(has('ArrowRight','d','D'))-Number(has('ArrowLeft','a','A')),y=Number(has('ArrowDown','s','S'))-Number(has('ArrowUp','w','W'));
    if(gp){if(Math.abs(gp.axes?.[0])>.15)x=gp.axes[0];if(Math.abs(gp.axes?.[1])>.15)y=gp.axes[1];}
    if(this.overhead&&Math.hypot(x,y)>1){const n=Math.hypot(x,y);x/=n;y/=n;}
    return{x,y,jump:has(' ')||(!this.overhead&&has('ArrowUp','w','W'))||gp?.buttons?.[0]?.pressed,attack:has('x','X','j','J')||gp?.buttons?.[2]?.pressed,interact:has('e','E','Enter')||gp?.buttons?.[1]?.pressed};
  }
  update(dt,keys=new Set()) {
    if(this.paused||this.won||!Number.isFinite(dt)||dt<=0)return;
    this.accumulator+=Math.min(dt,.25);const input=this.input(keys),step=1/120;
    while(this.accumulator+1e-9>=step&&!this.paused&&!this.won){this.accumulator=Math.max(0,this.accumulator-step);this.step(step,input);}
  }
  step(dt,input) {
    const scene=this.scene,p=this.player;this.elapsed+=dt;this.sceneTime+=dt;
    if(this.entryPending){this.entryPending=false;this.dispatch('enter',scene.id);if(this.scene!==scene)return;}
    const ready=this.pending.filter(job=>job.at<=this.sceneTime+1e-9);this.pending=this.pending.filter(job=>job.at>this.sceneTime+1e-9);
    for(const job of ready){this.runAction(job.rule,job.detail);if(this.scene!==scene)return;}
    for(const [index,rule]of scene.events.entries())if(rule.event==='timer'&&rule.enabled!==false){
      const id=rule.id||`rule-${index}`,period=Math.max(1/120,runtimeNumber(rule.period,1));
      if(this.sceneTime+1e-9>=(this.timerNext.get(id)??period)){this.timerNext.set(id,this.sceneTime+period);if(!this.fired.has(id))this.scheduleRule(rule,id);if(this.scene!==scene)return;}
    }
    for(const key of ['invincible','attack','attackCooldown','shake'])this[key]=Math.max(0,this[key]-dt);
    if(this.message&&this.message.until<=this.sceneTime)this.message=null;
    if(input.x){this.facing=Math.sign(input.x);p.flipX=input.x<0;}
    if(input.x||input.y)this.aim=this.overhead?{x:input.x,y:input.y}:{x:this.facing,y:0};
    const acceleration=runtimeNumber(p.acceleration,1200),speed=p.speed;
    this.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,input.x*speed-this.vx));
    if(this.overhead)this.vy+=Math.max(-acceleration*dt,Math.min(acceleration*dt,input.y*speed-this.vy));
    else{
      if(input.jump&&!this.previousJump)this.buffer=.12;this.buffer-=dt;this.coyote=this.grounded?.1:this.coyote-dt;
      if(this.buffer>0&&this.coyote>0){this.vy=-runtimeNumber(p.jump,315);this.buffer=0;this.coyote=0;this.grounded=false;}
      const gravity=runtimeNumber(p.gravity,900);if(!input.jump&&this.vy< -120)this.vy+=gravity*dt;this.vy=Math.min(550,this.vy+gravity*dt);
    }
    this.previousJump=!!input.jump;this.updateEntities(dt);if(this.scene!==scene)return;
    const previousBottom=p.y+p.h,fallSpeed=this.vy;this.move(dt);
    if(input.attack&&this.attackCooldown<=0){this.attack=.18;this.attackCooldown=.28;this.attackHits.clear();this.dispatch('attack',p.id);if(this.scene!==scene)return;if(scene.gameType==='run-and-gun')this.shoot(p,true);this.notify('sound',{sound:'attack'});}
    let interact=input.interact&&!this.previousInteract;this.previousInteract=!!input.interact;
    if(interact&&this.dialogue){const finished=this.dialogue;this.dialogue=null;interact=false;this.dispatch('dialogue',finished.sourceId);if(this.scene!==scene)return;}
    const contacts=new Set();
    for(const e of [...scene.entities]){
      if(e===p||e.dead)continue;const overlap=runtimeOverlap(p,e),near=Math.hypot(e.x-p.x,e.y-p.y)<36;
      if(overlap){contacts.add(e.id);if(!this.contacts.has(e.id))this.dispatch('enter',e.id);}if(this.scene!==scene)return;if(e.dead)continue;
      if(runtimeHostile(e)||e.type==='breakable'||e.behavior==='destructible'){
        const dx=e.x+e.w/2-p.x-p.w/2,dy=e.y+e.h/2-p.y-p.h/2;
        const reach=this.overhead?Math.hypot(dx,dy)<32&&dx*this.aim.x+dy*this.aim.y>=0:Math.abs(dx)<30&&Math.abs(dy)<24&&dx*this.facing>=0;
        if(this.attack>0&&reach&&!this.attackHits.has(e.id)){this.attackHits.add(e.id);this.damageEntity(e,p.damage||1);this.dispatch('attack',e.id);}if(this.scene!==scene)return;if(e.dead)continue;
        if(overlap&&runtimeHostile(e)){if(!this.overhead&&fallSpeed>40&&previousBottom<=e.y+8&&e.type!=='boss'){this.damageEntity(e,1);this.vy=-220;}else this.hit(e.damage);}
      }
      if(this.scene!==scene)return;
      if(overlap){
        if(['gem','health','key'].includes(e.type)){
          e.dead=true;if(e.type==='gem')this.score+=25;if(e.type==='health')this.health=Math.min(this.maxHealth,this.health+1);
          if(e.type==='key'){const id=e.keyId||e.id;this.keys.add(id);this.inventory[id]=(this.inventory[id]||0)+1;}this.dispatch('collect',e.id);this.notify('sound',{sound:'collect'});
        }
        if(e.type==='checkpoint'||e.type==='savepoint')this.setCheckpoint(e);
        if(e.type==='hazard'&&e.behavior!=='projectile'&&(e.behavior!=='timed'||e.on))this.hit(e.damage);
      }
      if(this.scene!==scene)return;
      if(e.type==='switch'&&((interact&&near)||(overlap&&!this.contacts.has(e.id)))){e.active=!e.active;this.dispatch('switch',e.id,{active:e.active});}
      if(e.type==='npc'&&interact&&near){this.dialogue={text:e.text||e.name||'',sourceId:e.id};interact=false;this.notify('dialogue',this.dialogue);}if(this.scene!==scene)return;
      if(['door','transition'].includes(e.type)&&(overlap||(near&&e.locked&&e.keyId&&this.keys.has(e.keyId)))){
        if(e.locked&&e.keyId&&this.keys.has(e.keyId)){e.locked=false;e.open=true;}
        if(!e.locked){this.dispatch('door',e.id);if(this.scene!==scene)return;this.transition(e.targetScene||'');return;}
      }
    }
    for(const id of this.contacts)if(!contacts.has(id)){this.dispatch('leave',id);if(this.scene!==scene)return;}this.contacts=contacts;
    for(const hazard of this.hazards)if(runtimeOverlap(p,hazard))this.hit();if(p.y>scene.height*16+64)this.respawn();
  }
  shoot(source,friendly=false) {
    const aim=friendly?this.aim:{x:this.player.x-source.x,y:this.player.y-source.y},length=Math.hypot(aim.x,aim.y)||1;
    this.scene.entities.push(this.prepareEntity({id:`projectile-${++this.sequence}`,type:'hazard',behavior:'projectile',x:source.x+source.w/2,y:source.y+source.h/2,w:4,h:4,speed:220,health:1,damage:source.damage||1,friendly,dx:aim.x/length,dy:aim.y/length,life:3,visible:true}));
  }
  updateEntities(dt) {
    const scene=this.scene,p=this.player;
    for(const e of [...scene.entities]){
      if(e===p||e.dead)continue;e.age=(e.age||0)+dt;e.cooldown=Math.max(0,(e.cooldown||0)-dt);e.flash=Math.max(0,(e.flash||0)-dt);e.origin??=e.x;e.originY??=e.y;e.dir??=1;
      if(e.behavior==='timed'){const period=Math.max(.1,runtimeNumber(e.period,2));e.on=e.age%period<period/2;}
      if(e.behavior==='projectile'){
        const dx=(e.dx??e.dir)*e.speed*dt,dy=(e.dy??0)*e.speed*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));
        for(let i=0;i<steps&&!e.dead;i++){
          const moved=this.moveBody(e,dx/steps,dy/steps,{oneWay:false});if(moved.blockedX||moved.blockedY){e.dead=true;break;}
          if(e.friendly){for(const target of scene.entities)if(!target.dead&&(runtimeHostile(target)||target.type==='breakable')&&runtimeOverlap(e,target)){this.damageEntity(target,e.damage);e.dead=true;break;}}
          else if(runtimeOverlap(e,p)){this.hit(e.damage);e.dead=true;}if(this.scene!==scene)return;
        }
        if(e.age>(e.life||3))e.dead=true;continue;
      }
      if(e.type==='emitter'||(e.type==='boss'&&e.active!==false)){
        if(e.type==='boss'&&!this.boss){this.boss=e;this.dispatch('boss',e.id);if(this.scene!==scene)return;}
        if(e.cooldown<=0){this.shoot(e);e.cooldown=Math.max(.15,runtimeNumber(e.period,e.type==='boss'?1.2:2));}
      }
      if(!(e.type==='platform'||runtimeHostile(e)||e.behavior==='moving'||e.behavior==='rider'))continue;
      const oldX=e.x,oldY=e.y,standing=Math.abs(p.y+p.h-e.y)<1&&p.x+p.w>e.x&&p.x<e.x+e.w;let dx=0,dy=0;
      if(e.path?.length){
        const point=e.path[e.pathIndex||0],distance=Math.hypot(point.x-e.x,point.y-e.y),travel=e.speed*dt;
        if(distance<=travel){dx=point.x-e.x;dy=point.y-e.y;e.pathIndex=((e.pathIndex||0)+1)%e.path.length;}else{dx=(point.x-e.x)/distance*travel;dy=(point.y-e.y)/distance*travel;}
      }else if(!['stationary','destructible','timed'].includes(e.behavior)){
        const distance=Math.hypot(p.x-e.x,p.y-e.y),chase=['chasing','boss','ambush'].includes(e.behavior);
        if(e.behavior==='ambush'&&distance<runtimeNumber(e.patrol,96))e.awake=true;
        if(e.behavior!=='ambush'||e.awake){
          if(chase){e.dir=Math.sign(p.x-e.x)||e.dir;dx=e.dir*e.speed*dt;if(this.overhead){dx=(p.x-e.x)/Math.max(1,distance)*e.speed*dt;dy=(p.y-e.y)/Math.max(1,distance)*e.speed*dt;}}
          else{const vertical=e.direction==='up'||e.direction==='down';if(Math.abs(vertical?e.y-e.originY:e.x-e.origin)>=runtimeNumber(e.patrol,64))e.dir=-Math.sign(vertical?e.y-e.originY:e.x-e.origin)||1;dx=vertical?0:e.dir*e.speed*dt;dy=vertical?e.dir*e.speed*dt:0;}
        }
      }
      if(e.type==='platform'){e.x+=dx;e.y+=dy;if(standing&&!this.overhead)this.moveBody(p,e.x-oldX,e.y-oldY,{entities:false});}
      else{
        const flying=e.behavior==='flying'||e.path?.length;
        if(!this.overhead&&!flying){e.vy=Math.min(550,(e.vy||0)+900*dt);dy=e.vy*dt;}
        const moved=this.moveBody(e,dx,dy);if(moved.blockedX)e.dir*=-1;if(moved.blockedY)e.vy=0;if(e.y>scene.height*16+64)this.defeat(e);
      }
      e.flipX=e.dir<0;if(this.scene!==scene)return;
    }
    this.scene.entities=this.scene.entities.filter(e=>!(e.dead&&e.behavior==='projectile'));
  }
  render(c,w,h) {
    const vw=this.scene.camera.w||384,vh=this.scene.camera.h||216,fit=Math.min(w/vw,h/vh),scale=fit>=1?Math.floor(fit):fit;
    const rw=vw*scale,rh=vh*scale,px=Math.floor((w-rw)/2),py=Math.floor((h-rh)/2);
    if(!this.surface){if(typeof OffscreenCanvas!=='undefined')this.surface=new OffscreenCanvas(vw,vh);else if(globalThis.document?.createElement)this.surface=document.createElement('canvas');}
    c.imageSmoothingEnabled=false;c.fillStyle='#0c0d14';c.fillRect(0,0,w,h);const off=this.surface?.getContext('2d');
    if(off){this.surface.width=vw;this.surface.height=vh;off.imageSmoothingEnabled=false;this.renderFrame(off,vw,vh);c.drawImage(this.surface,px,py,rw,rh);}
    else{c.save();c.beginPath();c.rect(px,py,rw,rh);c.clip();c.translate(px,py);c.scale(scale,scale);this.renderFrame(c,vw,vh);c.restore();}
  }
  renderFrame(c,vw,vh) {
    const focus=typeof this.cameraTarget==='string'?this.scene.entities.find(e=>e.id===this.cameraTarget):this.cameraTarget,target=focus||this.player;
    const shake=this.shake>0?Math.round(Math.sin(this.elapsed*90)*2):0;
    const cx=Math.round(Math.max(0,Math.min(Math.max(0,this.scene.width*16-vw),target.x-vw*.4)))+shake,cy=Math.round(Math.max(0,Math.min(Math.max(0,this.scene.height*16-vh),target.y-vh*.58)));
    drawScene(c,this.scene,{x:-cx,y:-cy,scale:1,width:vw,height:vh,time:this.elapsed,assets:this.project?.assets,customSprite:this.project?.sprite,entities:this.scene.entities.filter(e=>!e.dead&&(e!==this.player||this.invincible<=0||Math.floor(this.elapsed*14)%2===0))});
    if(this.attack>0){c.strokeStyle='#f9efd1';c.lineWidth=2;c.beginPath();c.arc(this.player.x-cx+this.player.w/2+this.aim.x*10,this.player.y-cy+8+this.aim.y*10,10,0,Math.PI*2);c.stroke();}
    const hud={health:true,score:true,timer:true,lives:true,keys:true,boss:true,...this.scene.hud},labels=[];
    if(hud.health)labels.push(`HP ${Math.max(0,this.health)}/${this.maxHealth}`);if(hud.score)labels.push(String(this.score).padStart(5,'0'));if(hud.timer)labels.push(`${Math.floor(this.elapsed/60)}:${String(Math.floor(this.elapsed%60)).padStart(2,'0')}`);if(hud.lives)labels.push(`L ${this.lives}`);if(hud.keys)labels.push(`K ${this.keys.size}`);
    c.font='bold 9px monospace';c.textAlign='left';if(labels.length){c.fillStyle='#101720dc';c.fillRect(7,7,vw-14,20);c.fillStyle='#e4edce';c.fillText(labels.join('  '),14,21);}
    if(hud.objective){c.fillStyle='#e4edce';c.fillText(String(hud.objective),14,39);}
    if(hud.boss&&this.boss&&!this.boss.dead){c.fillStyle='#101720';c.fillRect(vw/4,45,vw/2,8);c.fillStyle='#ec6e88';c.fillRect(vw/4,45,vw/2*Math.max(0,this.boss.health/this.boss.maxHealth),8);}
    const text=this.dialogue?.text||this.message?.text;
    if(text){c.fillStyle='#101720ef';c.fillRect(7,vh-48,vw-14,41);c.fillStyle='#e4edce';const limit=Math.max(8,Math.floor((vw-28)/6));for(let i=0;i<3;i++)c.fillText(text.slice(i*limit,(i+1)*limit),14,vh-34+i*11);}
    if(this.paused||this.won){c.fillStyle='#101720df';c.fillRect(vw/2-102,vh/2-34,204,68);c.fillStyle='#e4edce';c.textAlign='center';c.font='bold 14px monospace';c.fillText(this.won?'STAGE CLEAR!':'PAUSED',vw/2,vh/2-6);c.font='8px monospace';c.fillText(this.won?'R to restart · Enter to edit':'Esc to resume · R to restart',vw/2,vh/2+15);c.textAlign='left';}
  }
}
