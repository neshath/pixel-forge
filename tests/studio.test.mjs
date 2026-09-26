import test from 'node:test';
import assert from 'node:assert/strict';
import {project,validate,validateExtended,History,fill,line,entity,collisionAt} from '../src/model.js';
import {Runtime} from '../src/runtime.js';
import {drawEntity} from '../src/render.js';
test('project round-trip preserves edits and rejects unrelated files',()=>{const p=project(true);p.scenes[0].layers[1].tiles['2,2']=3;assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);assert.throws(()=>validate({scenes:[]}));});
test('custom entities render their assigned library sprite',()=>{
 const p=project(),asset={id:'sprite-1',name:'Library',size:1,frames:[['#abcdef']],timing:160,mode:'loop'};
 p.sprite.frames=[['#111111']];const e=entity('custom',0,0);e.spriteId=asset.id;e.w=e.h=1;
 const fills=[],c={save(){},restore(){},translate(){},rotate(){},scale(){},fillRect(){fills.push(this.fillStyle)}};
 drawEntity(c,e,undefined,0,{assets:[asset],customSprite:p.sprite});assert.equal(fills[0],'#abcdef');
});
test('custom sprite entities round-trip with their saved sprite asset',()=>{const p=project();const sprite={id:'sprite-1',name:'Hero',size:8,frames:[Array(64).fill('#ffffff')],timing:160,mode:'loop',folder:'Sprites',tags:[]};p.assets.push(sprite);const e=entity('custom',32,32);e.spriteId=sprite.id;e.w=e.h=8;p.scenes[0].entities.push(e);const loaded=validateExtended(JSON.parse(JSON.stringify(p)));assert.equal(loaded.scenes[0].entities[0].type,'custom');assert.equal(loaded.scenes[0].entities[0].spriteId,'sprite-1');assert.equal(loaded.assets[0].frames[0][0],'#ffffff');});
test('empty project contains no fictional user content',()=>{const p=project();assert.equal(p.scenes[0].entities.length,0);assert.ok(p.scenes[0].layers.every(l=>Object.keys(l.tiles).length===0));assert.throws(()=>new Runtime(p.scenes[0]),/player spawn/)});
test('undo and redo preserve independent snapshots',()=>{let p=project(),h=new History();h.push(p);p.name='Changed';p=h.undo(p);assert.equal(p.name,'Untitled project');p=h.redo(p);assert.equal(p.name,'Changed');});
test('fill is bounded by terrain and line covers both endpoints',()=>{const map={'1,0':2,'1,1':2,'1,2':2};fill(map,0,0,1,3,3);assert.equal(map['0,2'],1);assert.equal(map['2,0'],undefined);assert.equal(map['1,1'],2);assert.deepEqual(line(0,0,2,2),[[0,0],[1,1],[2,2]]);});
test('collision overrides can remove and add solids',()=>{const s=project().scenes[0];s.layers[1].tiles['1,1']=1;assert.equal(collisionAt(s,1,1),1);s.collision['1,1']=false;assert.equal(collisionAt(s,1,1),0);s.collision['2,2']=true;assert.equal(collisionAt(s,2,2),2);});
test('scenes persist automatic music selection',()=>{
  const p=project();
  p.audio.music.push({id:'music-1',name:'Theme',mime:'audio/mpeg',bytes:4,data:'data:audio/mpeg;base64,AAAA',loop:true});
  p.scenes[0].musicId='music-1';
  const loaded=validateExtended(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.scenes[0].musicId,'music-1');
});
test('runtime resolves imported audio by id or name',()=>{const p=project();p.audio.effects.push({id:'fx-1',name:'Jump',mime:'audio/wav',bytes:4,data:'data:audio/wav;base64,AAAA',loop:false});p.audio.music.push({id:'music-1',name:'Theme',mime:'audio/mpeg',bytes:4,data:'data:audio/mpeg;base64,AAAA',loop:true});const r=new Runtime({...p.scenes[0],entities:[entity('player',32,32)]},p);assert.equal(r.findAudio('fx-1').name,'Jump');assert.equal(r.findAudio('Jump').id,'fx-1');assert.equal(r.findAudio('Theme').loop,true);assert.equal(r.findAudio('missing'),null);});
test('runtime tracks active audio, mutes it, disposes it, and cleans failed playback',async()=>{
 const OriginalAudio=globalThis.Audio,OriginalContext=globalThis.AudioContext,instances=[];
 class FakeAudio{constructor(src){this.src=src;this.muted=false;this.loop=false;this.currentTime=0;this.volume=1;this.paused=false;instances.push(this)}async play(){if(FakeAudio.reject)throw Error('play rejected');this.paused=false}pause(){this.paused=true}}
 FakeAudio.reject=false;globalThis.Audio=FakeAudio;globalThis.AudioContext=undefined;
 try{
  const p=project();p.audio.music.push({id:'music-1',name:'Theme',mime:'audio/mpeg',bytes:4,data:'data:audio/mpeg;base64,AAAA',loop:true});
  p.audio.effects.push({id:'fx-1',name:'Click',mime:'audio/wav',bytes:4,data:'data:audio/wav;base64,AAAA',loop:false});
  const r=new Runtime({...p.scenes[0],entities:[entity('player',32,32)]},p);r.audioReady=true;
  assert.equal(await r.playAudio('music-1'),true);assert.equal(r.activeAudio.size,1);const music=instances[0];
  r.setMuted(true);assert.equal(music.muted,true);r.setMuted(false);assert.equal(music.muted,false);
  assert.equal(await r.playAudio('fx-1'),true);assert.equal(r.activeAudio.size,2);
  r.stopAllAudio();assert.equal(r.activeAudio.size,0);assert.equal(music.paused,true);assert.equal(music.src,'');assert.equal(r.currentMusic,null);
  FakeAudio.reject=true;assert.equal(await r.playAudio('fx-1'),false);assert.equal(r.activeAudio.size,0);
 }finally{globalThis.Audio=OriginalAudio;globalThis.AudioContext=OriginalContext}
});
test('audio assets round-trip as effects and music and reject invalid data',()=>{const p=project();p.audio.effects.push({id:'fx-1',name:'Jump',mime:'audio/wav',bytes:4,data:'data:audio/wav;base64,AAAA',loop:false});p.audio.music.push({id:'music-1',name:'Theme',mime:'audio/mpeg',bytes:4,data:'data:audio/mpeg;base64,AAAA',loop:true});const loaded=validateExtended(JSON.parse(JSON.stringify(p)));assert.equal(loaded.audio.effects[0].name,'Jump');assert.equal(loaded.audio.music[0].loop,true);const invalid=JSON.parse(JSON.stringify(p));invalid.audio.effects[0].data='not-a-data-url';assert.throws(()=>validateExtended(invalid),/audio library/);const tooLarge=JSON.parse(JSON.stringify(p));tooLarge.audio.effects[0].bytes=4*1024*1024+1;assert.throws(()=>validateExtended(tooLarge),/audio library/);const tooMuch=project();for(let i=0;i<2;i++)tooMuch.audio.effects.push({id:`fx-${i}`,name:`FX ${i}`,mime:'audio/wav',bytes:4*1024*1024,data:'data:audio/wav;base64,AAAA',loop:false});tooMuch.audio.effects.push({id:'fx-extra',name:'Extra',mime:'audio/wav',bytes:1,data:'data:audio/wav;base64,AA==',loop:false});assert.throws(()=>validateExtended(tooMuch),/too large/);});
function flat(){const s=project().scenes[0];for(let x=0;x<64;x++)s.layers[1].tiles[`${x},10`]=1;s.entities=[entity('player',32,130)];return s;}
test('runtime lands, accelerates, jumps and preserves the editing scene',()=>{const s=flat(),before=JSON.stringify(s),r=new Runtime(s);for(let i=0;i<90;i++)r.update(1/60,new Set());assert.equal(r.player.y,144);assert.ok(r.grounded);for(let i=0;i<20;i++)r.update(1/60,new Set(['ArrowRight']));assert.ok(r.player.x>50);const y=r.player.y;r.update(1/60,new Set([' ']));assert.ok(r.player.y<y);assert.equal(JSON.stringify(s),before);});
test('checkpoint captures once and restores later world changes on respawn',()=>{
 const s=flat(),gem=entity('gem',80,144),checkpoint=entity('checkpoint',32,144),enemy=entity('enemy',112,144);
 s.entities.push(gem,checkpoint,enemy);const r=new Runtime(s);r.setCheckpoint(checkpoint);
 const snapshotAfterActivation=JSON.stringify(r.checkpointState);
 gem.dead=true;enemy.dead=true;r.score=250;r.setCheckpoint(checkpoint);
 assert.equal(JSON.stringify(r.checkpointState),snapshotAfterActivation);
 r.respawn();assert.equal(r.scene.entities.find(e=>e.id===gem.id).dead,undefined);assert.equal(r.scene.entities.find(e=>e.id===enemy.id).dead,undefined);assert.equal(r.score,0);
});
test('collectibles score, checkpoints update respawn, doors complete the stage',()=>{const s=flat();s.entities.push(entity('gem',32,144),entity('checkpoint',32,144));const r=new Runtime(s);for(let i=0;i<30;i++)r.update(1/60,new Set());assert.equal(r.score,25);assert.equal(r.spawn.y,144);r.scene.entities.push(entity('door',32,128));r.update(1/60,new Set());assert.ok(r.won);});
test('one-way platforms allow upward travel and stop downward travel',()=>{const s=flat();s.layers[1].tiles['2,7']=4;const r=new Runtime(s);r.player.y=130;r.vy=-300;for(let i=0;i<8;i++)r.update(1/60,new Set([' ']));assert.ok(r.player.y<112);for(let i=0;i<60;i++)r.update(1/60,new Set());assert.equal(r.player.y,96);});
test('falling respawns and pause freezes the simulation',()=>{const r=new Runtime(flat());r.player.y=1000;r.update(1/60,new Set());assert.equal(r.deaths,1);r.paused=true;const before=JSON.stringify(r);r.update(1/60,new Set(['ArrowRight']));assert.equal(JSON.stringify(r),before);});
