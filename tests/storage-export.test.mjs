import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {templateProject} from '../src/templates.js';
import {gardenPacks} from '../src/garden.js';
import {project,makeScene,initializeScene,entity,createRule,clone} from '../src/model.js';
import {ProjectStore,STORAGE_KEY,LEGACY_KEY} from '../src/storage.js';
import {buildGameHTML,buildProjectPackage} from '../src/export.js';
import {Runtime} from '../src/runtime.js';

class MemoryStorage {
  data=new Map();fail=null;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail?.(key))throw Error('Quota exceeded');this.data.set(key,String(value));}
  removeItem(key){if(this.fail?.(key))throw Error('Storage unavailable');this.data.delete(key);}
}
test('stable IDs, metadata, independent loads and full project package',()=>{
  const store=new ProjectStore(new MemoryStorage()),p=project();
  p.settings={audio:true};p.assets=[{data:'data:image/png;base64,AA=='}];p.events=[{type:'start'}];
  const first=store.save(p);assert.equal(first.id,p.id);assert.equal(first.sceneCount,1);
  p.name='Renamed';store.save(p);assert.equal(store.list().length,1);assert.equal(store.list()[0].id,first.id);
  const loaded=store.load(p.id);loaded.name='Not saved';assert.equal(store.load(p.id).name,'Renamed');
  assert.deepEqual(JSON.parse(buildProjectPackage(p)),p);assert.equal(store.load('missing'),null);
});
test('versions are bounded per project and globally, and restoration is a new save',()=>{
  const store=new ProjectStore(new MemoryStorage()),p=project();
  for(let i=0;i<12;i++){p.name='v'+i;store.save(p);}
  assert.equal(store.versions(p.id).length,8);
  const oldest=store.versions(p.id).at(-1);assert.equal(oldest.name,'v4');
  assert.equal(store.restoreVersion(p.id,oldest.id).name,'v4');assert.equal(store.versions(p.id).length,8);
  const ids=[p.id];for(let i=0;i<10;i++){const q=project();ids.push(store.save(q).id);for(let j=0;j<8;j++)store.save(q);}
  assert.ok(ids.reduce((sum,id)=>sum+store.versions(id).length,0)<=64);
});
test('trash is recoverable, survives a new store, and retains history',()=>{
  const storage=new MemoryStorage(),store=new ProjectStore(storage),p=project();store.save(p);
  assert.equal(store.remove(p.id),true);assert.equal(store.load(p.id),null);assert.equal(store.listTrash()[0].id,p.id);
  assert.equal(store.loadLatest(),null);assert.throws(()=>store.save(p),/trash/);
  const reopened=new ProjectStore(storage);assert.deepEqual(reopened.restoreTrash(p.id),p);
  assert.equal(reopened.versions(p.id).length,1);assert.equal(reopened.listTrash().length,0);
});
test('legacy-only autosaves migrate once and later editor writes remain loadable',()=>{
  const storage=new MemoryStorage(),p=project();storage.setItem(LEGACY_KEY,JSON.stringify(p));
  const store=new ProjectStore(storage),loaded=store.loadLatest();assert.ok(loaded.id);
  assert.equal(store.list().length,1);assert.equal(store.loadLatest().id,loaded.id);assert.equal(store.versions(loaded.id).length,1);
  loaded.name='Edited in app';storage.setItem(LEGACY_KEY,JSON.stringify(loaded));
  assert.equal(store.loadLatest().name,'Edited in app');assert.equal(store.list().length,1);
});
test('failed writes at each transaction stage preserve the previous project and mirror',()=>{
  for(const failedKey of [STORAGE_KEY+'-journal',LEGACY_KEY,STORAGE_KEY]){
    const storage=new MemoryStorage(),store=new ProjectStore(storage),p=project();store.save(p);
    const before=storage.getItem(STORAGE_KEY),legacy=storage.getItem(LEGACY_KEY),stamp=p.updatedAt;
    p.name='Unsaved';storage.fail=key=>key===failedKey;
    assert.throws(()=>store.save(p));assert.equal(storage.getItem(STORAGE_KEY),before);assert.equal(p.updatedAt,stamp);
    storage.fail=null;const reopened=new ProjectStore(storage);assert.equal(reopened.load(p.id).name,'Untitled project');
    assert.equal(storage.getItem(LEGACY_KEY),legacy);
  }
});
test('saving a new project before migration preserves the old editor autosave',()=>{
  const storage=new MemoryStorage(),legacy=project();legacy.name='Old editor work';
  storage.setItem(LEGACY_KEY,JSON.stringify(legacy));const store=new ProjectStore(storage),p=project();p.name='New project';
  store.save(p);assert.equal(store.list().length,2);
  assert.equal(store.load(store.list().find(m=>m.name==='Old editor work').id).name,'Old editor work');
});
test('interrupted mirror rollback is retried and committed cleanup failure stays committed',()=>{
  const storage=new MemoryStorage(),store=new ProjectStore(storage),p=project();store.save(p);
  let failAll=false;storage.fail=key=>{if(key===STORAGE_KEY)failAll=true;return failAll;};
  p.name='Interrupted';assert.throws(()=>store.save(p));assert.ok(storage.getItem(STORAGE_KEY+'-journal'));
  storage.fail=null;assert.equal(new ProjectStore(storage).loadLatest().name,'Untitled project');
  const remove=storage.removeItem.bind(storage);storage.removeItem=()=>{throw Error('cleanup denied');};
  store.save(p);storage.removeItem=remove;assert.equal(new ProjectStore(storage).loadLatest().name,'Interrupted');
});
test('invalid input and corrupt persisted JSON never reset existing data',()=>{
  const storage=new MemoryStorage(),store=new ProjectStore(storage),p=project();store.save(p);
  const before=storage.getItem(STORAGE_KEY);assert.throws(()=>store.save({}));assert.equal(storage.getItem(STORAGE_KEY),before);
  storage.setItem(STORAGE_KEY,'broken');assert.throws(()=>store.list());assert.equal(storage.getItem(STORAGE_KEY),'broken');
});
function comprehensiveExportProject(){
 const p=project(),s1=p.scenes[0],s2=initializeScene(makeScene('Second scene'));
 s1.width=s2.width=20;s1.height=s2.height=12;s1.camera=s2.camera={x:0,y:0,w:320,h:192};
 for(const s of [s1,s2])for(let x=0;x<20;x++){s.layers[1].tiles[x+',10']=1;s.layers[1].tiles[x+',11']=2;}
 const player=entity('player',16,144),checkpoint=entity('checkpoint',32,144),gem=entity('gem',80,144),enemy=entity('enemy',112,144),switcher=entity('switch',144,144);
 player.spriteId='sprite-1';s1.entities=[player,checkpoint,gem,enemy,switcher];
 s2.entities=[entity('player',16,144),entity('gem',80,144)];
 const sprite={id:'sprite-1',name:'Hero',size:8,frames:[Array(64).fill('#abcdef')],timing:120,mode:'loop',folder:'Sprites',tags:[]};
 p.assets=[sprite];p.sprite=clone(sprite);
 p.audio={effects:[{id:'fx-1',name:'Click',mime:'audio/wav',bytes:4,data:'data:audio/wav;base64,AAAA',loop:false}],music:[
  {id:'music-1',name:'Forest',mime:'audio/mpeg',bytes:4,data:'data:audio/mpeg;base64,AAAA',loop:true},
  {id:'music-2',name:'Cave',mime:'audio/ogg',bytes:4,data:'data:audio/ogg;base64,AAAA',loop:true}
 ]};
 s1.musicId='music-1';s2.musicId='music-2';
 const rule=createRule();Object.assign(rule,{event:'switch',sourceId:switcher.id,action:'scene',targetId:s2.id});s1.events=[rule];
 s1.hud={health:true,score:true,timer:true,lives:true,keys:true,boss:false,objective:'Reach the second scene.'};
 p.scenes.push(s2);p.activeScene=0;return p;
}
test('end-to-end two-scene export fixture preserves checkpoint, logic, custom art, audio and export',async()=>{
 const p=comprehensiveExportProject(),s1=p.scenes[0],s2=p.scenes[1],r=new Runtime(s1,p);
 const cp=s1.entities.find(e=>e.type==='checkpoint'),gem=s1.entities.find(e=>e.type==='gem'),enemy=s1.entities.find(e=>e.type==='enemy');
 r.setCheckpoint(cp);gem.dead=true;enemy.dead=true;r.score=250;r.setCheckpoint(cp);r.respawn();
 assert.equal(r.score,0);assert.equal(r.scene.entities.find(e=>e.id===gem.id).dead,undefined);assert.equal(r.scene.entities.find(e=>e.id===enemy.id).dead,undefined);
 const sw=r.scene.entities.find(e=>e.type==='switch');r.dispatch('switch',sw.id);assert.equal(r.scene.id,s2.id);assert.equal(r.scene.musicId,'music-2');
 const html=await buildGameHTML(p,undefined,fsLoader);
 for(const token of ['sprite-1','music-1','music-2','Second scene','🔊 Mute'])assert.ok(html.includes(token),token);
 new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
const fsLoader=url=>readFile(new URL(url),'utf8');
for(const format of ['platformer','topdown','2.5d',...Object.keys(gardenPacks)])test('actual '+format+' sources bundle, compile and start offline with full project',async()=>{
  const p=templateProject(gardenPacks[format]?'2.5d':format);if(gardenPacks[format])p.scenes[0].biome=format;p.settings={volume:.5};p.assets=[];p.events=[];
  p.name='Test </script><script>throw Error("injection")</script> & title';
  const requested=[];const html=await buildGameHTML(p,undefined,async url=>{requested.push(url);return fsLoader(url);});
  assert.ok(requested.some(url=>url.endsWith('/runtime.js')));assert.equal(new Set(requested).size,requested.length);
  assert.ok(html.includes('&lt;/script&gt;'));assert.equal((html.match(/<script>/g)||[]).length,1);
  const source=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(source);
  const handlers={},elements={};const context=new Proxy({},{get:(_,key)=>key==='canvas'?elements.game:()=>{},set:()=>true});
  for(const id of ['game','start','begin','pause','restart','mute','status']){const el={getContext:()=>context,focus(){},attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]}};elements[id]=el;}
  let tick;vm.runInNewContext(source,{document:{getElementById:id=>elements[id]},navigator:{getGamepads:()=>[]},addEventListener:(name,fn)=>handlers[name]=fn,requestAnimationFrame:fn=>{tick=fn;},console});
  await elements.begin.onclick();assert.equal(elements.start.hidden,true);assert.equal(elements.status.textContent,undefined);
  tick(16);handlers.keydown({key:'Escape',preventDefault(){}});tick(32);elements.mute.onclick();assert.equal(elements.mute.textContent,'🔇 Unmute');assert.equal(elements.mute.getAttribute?.('aria-pressed'),'true');elements.restart.onclick();tick(48);
  assert.equal(elements.game.width,p.scenes[0].camera.w);
});
test('recursive optional sources, duplicate local declarations and aliased exports',async()=>{
  const sources={
    'model.js':'const local=1; export {local as value};',
    'render.js':"import {value as local} from './model.js'; export function draw(){return local;}",
    'runtime.js':"import {value} from './logic.js'; import {draw} from './render.js'; export class Runtime {constructor(scene,project){this.project=project;} update(){} render(){draw();}}",
    'logic.js':"import {art} from './art.js'; const local=2; export const value=local+art;",
    'art.js':'const local=3; export const art=local;'
  };
  const requests=[];const html=await buildGameHTML(project(true),undefined,url=>{const name=new URL(url).pathname.split('/').at(-1);requests.push(name);return sources[name];});
  assert.equal(requests.length,5);new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
  await assert.rejects(buildGameHTML(project(), 'missing',fsLoader),/Scene not found/);
  await assert.rejects(buildGameHTML(project(),undefined,()=>"import x from 'https://example.com/x.js';"),/Unsupported source import/);
});
