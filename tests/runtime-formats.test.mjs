import test from 'node:test';
import assert from 'node:assert/strict';
import {project,validateExtended} from '../src/model.js';
import {Runtime} from '../src/runtime.js';
import {templateProject} from '../src/templates.js';
test('puzzle platformers use gravity while arcade templates use overhead controls',()=>{
 const p=project(true),s=p.scenes[0];s.gameType='puzzle';assert.equal(new Runtime(s,p).overhead,false);
 s.gameType='arcade';assert.equal(new Runtime(s,p).overhead,true);
});
test('2.5D water-world templates use overhead movement and validate as editable projects',()=>{
 const p=templateProject('2.5d'),s=p.scenes[0];assert.equal(s.gameType,'2.5d');assert.equal(s.biome,'watergarden');assert.ok(s.garden);assert.ok(s.entities.some(e=>e.propKind==='bridge'));assert.equal(new Runtime(s,p).overhead,true);assert.doesNotThrow(()=>validateExtended(JSON.parse(JSON.stringify(p))));
});
test('lava joins spikes as damage terrain and palette events support expanded environments',()=>{
 const p=project(true),s=p.scenes[0];s.layers.find(l=>l.id==='terrain').tiles['0,0']=16;
 const r=new Runtime(s,p);assert.ok(r.hazards.some(x=>x.x===0&&x.y===5));
 r.runAction({action:'palette',value:'jungle'});assert.equal(r.scene.biome,'jungle');
 r.runAction({action:'palette',value:'__proto__'});assert.equal(r.scene.biome,'jungle');
 assert.equal(s.biome,'forest');
});

test('launcher templates are distinct and Moonfern platformer remains reachable',()=>{
 const platformer=templateProject('platformer');
 const topdown=templateProject('topdown');
 const water=templateProject('2.5d');
 const arcade=templateProject('arcade');
 assert.equal(platformer.scenes[0].gameType,'platformer');
 assert.equal(platformer.scenes[0].name,'Moonfern crossing');
 assert.equal(platformer.sample,true);
 assert.equal(topdown.scenes[0].gameType,'topdown');
 assert.equal(topdown.scenes[0].name,'Understone · Lantern Vault');
 assert.equal(topdown.scenes[0].width,40);
 assert.equal(arcade.scenes[0].gameType,'arcade');
 assert.equal(arcade.scenes[0].name,'Nightwire · Arcade Run');
 assert.equal(arcade.scenes[0].width,64);
 assert.notEqual(topdown.scenes[0].name,arcade.scenes[0].name);
 assert.notDeepEqual(
  topdown.scenes[0].layers.find(l=>l.id==='terrain').tiles,
  arcade.scenes[0].layers.find(l=>l.id==='terrain').tiles
 );
 const topdownDoor=topdown.scenes[0].entities.find(e=>e.type==='door');
 const topdownSwitch=topdown.scenes[0].entities.find(e=>e.type==='switch');
 const switchRule=topdown.scenes[0].events.find(e=>e.sourceId===topdownSwitch.id);
 assert.equal(switchRule.action,'open');
 assert.equal(switchRule.targetId,topdownDoor.id);
});
