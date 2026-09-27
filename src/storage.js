import {validate,validateExtended} from './model.js';
import {IndexedAudioStore,stripAudioData} from './audio-storage.js';

/** ProjectStore keeps project metadata/history in localStorage and, in browsers,
 * stores audio payloads in IndexedDB so multi-megabyte media does not consume the
 * small synchronous localStorage quota. The public synchronous methods remain for
 * compatibility; browser autosave uses saveAsync/loadLatestAsync for hydrated data.
 */
export const STORAGE_KEY='pixel-forge-projects-v1';
export const LEGACY_KEY='pixel-forge-autosave';
const JOURNAL_KEY=STORAGE_KEY+'-journal';
const copy=value=>JSON.parse(JSON.stringify(value));
const uid=()=>globalThis.crypto.randomUUID();
const clean=value=>validate(copy(value));
const extended=value=>validateExtended(copy(value));
const meta=p=>({id:p.id,name:p.name,updatedAt:p.updatedAt,sceneCount:p.scenes.length});

export class ProjectStore {
  constructor(storage=globalThis.localStorage){
    this.storage=storage;
    this.audioStore=storage===globalThis.localStorage?new IndexedAudioStore():{available:false};
    this.saveQueue=Promise.resolve();
  }
  _mirror(value){if(value===null)this.storage.removeItem(LEGACY_KEY);else this.storage.setItem(LEGACY_KEY,value);}
  _recover(){
    const raw=this.storage.getItem(JOURNAL_KEY);if(!raw)return;
    const j=JSON.parse(raw);
    if(typeof j.after!=='string'||!(j.beforeLegacy===null||typeof j.beforeLegacy==='string'))throw Error('Invalid project recovery journal');
    this._mirror(this.storage.getItem(STORAGE_KEY)===j.after?j.afterLegacy:j.beforeLegacy);
    this.storage.removeItem(JOURNAL_KEY);
  }
  _read(){
    this._recover();const raw=this.storage.getItem(STORAGE_KEY);
    if(raw===null)return {version:1,projects:[],trash:[],latest:null};
    const state=JSON.parse(raw);
    if(state.version!==1||!Array.isArray(state.projects)||!Array.isArray(state.trash))throw Error('Invalid project storage');
    return state;
  }
  _commit(state){
    const latest=state.projects.find(r=>r.project.id===state.latest)?.project;
    const afterLegacy=latest?JSON.stringify(latest):null;
    const after=JSON.stringify(state),beforeLegacy=this.storage.getItem(LEGACY_KEY);
    this.storage.setItem(JOURNAL_KEY,JSON.stringify({after,beforeLegacy,afterLegacy}));
    try{this._mirror(afterLegacy);this.storage.setItem(STORAGE_KEY,after);}
    catch(error){try{this._recover();}catch{/* Journal remains for the next successful access. */}throw error;}
    try{this.storage.removeItem(JOURNAL_KEY);}catch{}
  }
  _bound(state){
    const records=[...state.projects,...state.trash];
    for(const r of records)r.versions=r.versions.slice(-8);
    const all=records.flatMap(r=>r.versions.map(v=>({r,v}))).sort((a,b)=>a.v.at-b.v.at);
    for(const {r,v} of all.slice(0,Math.max(0,all.length-64)))r.versions=r.versions.filter(x=>x.id!==v.id);
  }
  _revisions(state){
    const revisions=new Set();
    for(const r of [...state.projects,...state.trash]){
      if(r.project.audioRevision)revisions.add(r.project.audioRevision);
      for(const v of r.versions||[])if(v.audioRevision)revisions.add(v.audioRevision);
    }
    return revisions;
  }
  _stored(p,audioRevision=null){
    if(!audioRevision)return copy(p);
    const stored=copy(p);
    stored.audio=stripAudioData(stored.audio);
    stored.audioRevision=audioRevision;
    return stored;
  }
  _saveClean(p,storageProject,legacyProject=null){
    const state=this._read();
    if(legacyProject)state.projects.push(legacyProject);
    if(state.trash.some(r=>r.project.id===p.id))throw Error('Restore this project from trash before saving');
    let record=state.projects.find(r=>r.project.id===p.id);
    if(!record){record={project:storageProject,versions:[]};state.projects.push(record);}
    record.project=storageProject;
    record.versions.push({id:uid(),at:p.updatedAt,name:p.name,project:copy(storageProject),audioRevision:storageProject.audioRevision||undefined});
    state.latest=p.id;this._bound(state);this._commit(state);
    return meta(p);
  }
  save(project){
    const p=clean(project),state=this._read();
    const legacy=this.storage.getItem(LEGACY_KEY);
    let legacyProject=null;
    if(this.storage.getItem(STORAGE_KEY)===null&&legacy!==null){
      const old=clean(JSON.parse(legacy));
      if(JSON.stringify(old)!==JSON.stringify(p)&&(!old.id||old.id!==p.id)){
        old.id=old.id||uid();old.updatedAt=old.updatedAt||Date.now();
        legacyProject={project:old,versions:[{id:uid(),at:old.updatedAt,name:old.name,project:copy(old)}]};
      }
    }
    p.id=typeof p.id==='string'&&p.id?p.id:uid();p.updatedAt=Date.now();
    const result=this._saveClean(p,p,legacyProject);
    project.id=p.id;project.updatedAt=p.updatedAt;return result;
  }
  saveAsync(project){
    if(!this.audioStore.available)return Promise.resolve(this.save(project));
    const snapshot=clean(project);
    snapshot.id=typeof snapshot.id==='string'&&snapshot.id?snapshot.id:uid();
    snapshot.updatedAt=Date.now();
    const run=this.saveQueue.then(async()=>{
      const state=this._read(),legacy=this.storage.getItem(LEGACY_KEY);
      let legacyProject=null;
      if(this.storage.getItem(STORAGE_KEY)===null&&legacy!==null){
        const old=extended(JSON.parse(legacy));
        if(JSON.stringify(old)!==JSON.stringify(snapshot)&&(!old.id||old.id!==snapshot.id)){
          old.id=old.id||uid();old.updatedAt=old.updatedAt||Date.now();
          const revision=uid();await this.audioStore.put(revision,old.audio);
          const storedOld=this._stored(old,revision);
          legacyProject={project:storedOld,versions:[{id:uid(),at:old.updatedAt,name:old.name,project:copy(storedOld),audioRevision:revision}]};
        }
      }
      const revision=uid();
      await this.audioStore.put(revision,snapshot.audio);
      this._saveClean(snapshot,this._stored(snapshot,revision),legacyProject);
      project.id=snapshot.id;project.updatedAt=snapshot.updatedAt;
      await this.audioStore.prune(this._revisions(this._read()));
      return meta(snapshot);
    });
    this.saveQueue=run.catch(()=>{});
    return run;
  }
  list(){return this._read().projects.map(r=>meta(r.project)).sort((a,b)=>b.updatedAt-a.updatedAt);}
  load(id){const p=this._read().projects.find(r=>r.project.id===id)?.project;return p?clean(p):null;}
  async loadAsync(id){
    const p=this.load(id);if(!p)return null;
    if(!p.audioRevision)return extended(p);
    const audio=await this.audioStore.get(p.audioRevision);
    if(!audio)throw Error('Saved audio assets are unavailable. Your project metadata is intact; open a .pixel.json backup if needed.');
    p.audio=audio;delete p.audioRevision;return extended(p);
  }
  versions(id){return (this._read().projects.find(r=>r.project.id===id)?.versions||[]).map(({id,at,name})=>({id,at,name})).reverse();}
  restoreVersion(projectId,versionId){
    const r=this._read().projects.find(r=>r.project.id===projectId);
    const v=r?.versions.find(v=>v.id===versionId);if(!v)return null;
    const p=clean(v.project);p.id=projectId;this.save(p);return p;
  }
  async restoreVersionAsync(projectId,versionId){
    const r=this._read().projects.find(r=>r.project.id===projectId);
    const v=r?.versions.find(v=>v.id===versionId);if(!v)return null;
    const p=v.audioRevision?await this.loadVersionAsync(v):extended(v.project);
    p.id=projectId;await this.saveAsync(p);return p;
  }
  async loadVersionAsync(version){
    const p=clean(version.project);
    if(!version.audioRevision)return extended(p);
    const audio=await this.audioStore.get(version.audioRevision);
    if(!audio)throw Error('Saved version audio is unavailable.');
    p.audio=audio;delete p.audioRevision;return extended(p);
  }
  remove(id){
    const state=this._read(),index=state.projects.findIndex(r=>r.project.id===id);if(index<0)return false;
    const [r]=state.projects.splice(index,1);r.deletedAt=Date.now();state.trash.push(r);
    if(state.latest===id)state.latest=state.projects.at(-1)?.project.id||null;
    this._commit(state);return true;
  }
  listTrash(){return this._read().trash.map(r=>({...meta(r.project),deletedAt:r.deletedAt}));}
  restoreTrash(id){
    const state=this._read(),index=state.trash.findIndex(r=>r.project.id===id);if(index<0)return null;
    const [r]=state.trash.splice(index,1);delete r.deletedAt;state.projects.push(r);state.latest=id;
    this._commit(state);return clean(r.project);
  }
  async loadLatestAsync(){
    const state=this._read(),raw=this.storage.getItem(LEGACY_KEY);
    if(raw!==null){
      const p=extended(JSON.parse(raw));
      const current=state.projects.find(r=>r.project.id===state.latest)?.project;
      if(!current||JSON.stringify(clean(p))!==JSON.stringify(clean(current))||(!current.audioRevision&&p.audio)){
        await this.saveAsync(p);
      }
    }
    const latest=this._read().latest;
    return latest?this.loadAsync(latest):null;
  }
  loadLatest(){
    const state=this._read(),raw=this.storage.getItem(LEGACY_KEY);
    if(raw!==null){
      const p=clean(JSON.parse(raw));const current=state.projects.find(r=>r.project.id===state.latest)?.project;
      if(!current||JSON.stringify(p)!==JSON.stringify(current)){this.save(p);return p;}
      return clean(current);
    }
    const p=state.projects.find(r=>r.project.id===state.latest)?.project;return p?clean(p):null;
  }
}
