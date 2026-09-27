const DB_NAME='pixel-forge-audio-v1';
const DB_VERSION=1;
const STORE_NAME='revisions';

export const supportsIndexedDB=()=>typeof globalThis.indexedDB!=='undefined';

export const stripAudioData=audio=>({
  effects:(audio?.effects||[]).map(({data,...meta})=>meta),
  music:(audio?.music||[]).map(({data,...meta})=>meta)
});

function openDb(){
  if(!supportsIndexedDB())return Promise.reject(Error('IndexedDB is unavailable.'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE_NAME,{keyPath:'revision'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Could not open the audio store.'));
  });
}

export class IndexedAudioStore {
  constructor(){this.available=supportsIndexedDB();this.dbPromise=this.available?openDb():Promise.reject(Error('IndexedDB is unavailable.'));}
  async put(revision,audio){
    const db=await this.dbPromise;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).put({revision,audio});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Could not save audio assets.'));
      tx.onabort=()=>reject(tx.error||Error('Could not save audio assets.'));
    });
  }
  async get(revision){
    if(!revision)return null;
    const db=await this.dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly'),request=tx.objectStore(STORE_NAME).get(revision);
      request.onsuccess=()=>resolve(request.result?.audio||null);
      request.onerror=()=>reject(request.error||Error('Could not read audio assets.'));
    });
  }
  async delete(revision){
    if(!revision)return;
    const db=await this.dbPromise;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).delete(revision);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Could not delete audio assets.'));
    });
  }
  async prune(keep){
    const db=await this.dbPromise;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite'),store=tx.objectStore(STORE_NAME);
      const request=store.openCursor();
      request.onsuccess=()=>{const cursor=request.result;if(!cursor)return void 0; if(!keep.has(cursor.value.revision))cursor.delete();cursor.continue();};
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Could not prune audio assets.'));
    });
  }
}
