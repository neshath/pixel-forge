import {validate} from './model.js';

/** Export contract: JSON project output is directly importable by validate().
 * sourceLoader receives an absolute module URL and returns source text or a fetch
 * Response. Supports the app's static named/default/namespace imports and named
 * declarations/export lists. Each module has its own scope, avoiding collisions.
 * Only model/render/runtime/logic/art may be loaded; unsupported module syntax,
 * cycles and external imports fail explicitly. No CDN or runtime source fetching.
 */
export function buildProjectPackage(project){return JSON.stringify(validate(JSON.parse(JSON.stringify(project))),null,2);}
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const htmlText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function buildGameHTML(projectData,sceneId,sourceLoader=globalThis.fetch){
  const project=JSON.parse(buildProjectPackage(projectData));
  const scene=sceneId===undefined?project.scenes[project.activeScene]:project.scenes.find(s=>s.id===sceneId);
  if(!scene)throw Error('Scene not found');
  const modules=new Map(),visiting=new Set(),allowed=new Set(['model.js','render.js','runtime.js','logic.js','art.js','garden.js']);
  async function bundle(name){
    if(modules.has(name))return;if(visiting.has(name))throw Error('Circular source dependency: '+name);
    if(!allowed.has(name))throw Error('Unsupported source module: '+name);
    visiting.add(name);
    const response=await sourceLoader(new URL(name,import.meta.url).href);
    if(response?.ok===false)throw Error('Could not load '+name+': '+response.status);
    let source=typeof response==='string'?response:await response.text();
    const imports=[];
    source=source.replace(/\bimport\s*(?:([^;'"()]+?)\s*from\s*)?['"]([^'"]+)['"]\s*;?/g,(_,bindings,path)=>{
      if(!/^\.\/[\w-]+\.js$/.test(path)||!allowed.has(path.slice(2)))throw Error('Unsupported source import: '+path);
      imports.push({bindings:bindings?.trim(),name:path.slice(2)});return '';
    });
    let prefix='';
    for(const entry of imports){
      await bundle(entry.name);const ref='__modules['+JSON.stringify(entry.name)+']';const b=entry.bindings;
      if(!b)continue;
      if(b.startsWith('{'))prefix+='const '+b.replace(/\bas\b/g,':')+'='+ref+';\n';
      else if(/^\*\s+as\s+\w+$/.test(b))prefix+='const '+b.replace(/^\*\s+as\s+/,'')+'='+ref+';\n';
      else if(/^\w+$/.test(b))prefix+='const '+b+'='+ref+'.default;\n';
      else throw Error('Unsupported import bindings: '+b);
    }
    const exports=[];
    source=source.replace(/\bexport\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)((?:async\s+)?(?:function|class|const|let|var)\s+([\w$]+))/g,(_,decl,name)=>{exports.push(name+':'+name);return decl;});
    source=source.replace(/\bexport\s*\{([^}]+)\}\s*;?/g,(_,list)=>{for(const item of list.split(',').filter(x=>x.trim())){const [local,alias]=item.trim().split(/\s+as\s+/);exports.push((alias||local)+':'+local);}return '';});
    // Default exports use a private binding within this module's closure.
    source=source.replace(/\bexport\s+default\s+/g,()=>{exports.push('default:__default');return 'const __default = ';});
    if(/\b(?:import\s*(?:\(|\.|['"{*])|export\s+(?:\*|\{|default|const|function|class))/m.test(source))throw Error('Unsupported module syntax in '+name);
    modules.set(name,'__modules['+JSON.stringify(name)+']=(()=>{\n'+prefix+source+'\nreturn {'+exports.join(',')+'};\n})();');visiting.delete(name);
  }
  for(const name of ['model.js','render.js','runtime.js'])await bundle(name);
  const boot=`
const project=${safeJSON(project)}, scene=project.scenes.find(s=>s.id===${safeJSON(scene.id)});
const {Runtime}=__modules['runtime.js'];
const canvas=document.getElementById('game'), context=canvas.getContext('2d');
canvas.width=scene.camera.w||384;canvas.height=scene.camera.h||216;context.imageSmoothingEnabled=false;
let runtime,started=false,last=0,padPause=false,padRestart=false,muted=false;
const keys=new Set(),overlay=document.getElementById('start'),status=document.getElementById('status');
async function restart(){if(runtime)runtime.dispose?.();runtime=new Runtime(scene,project);if(runtime.unlockAudio)await runtime.unlockAudio();if(runtime.audio?.resume)await runtime.audio.resume();runtime.setMuted?.(muted);}
function pause(){if(runtime)runtime.paused=!runtime.paused;}
function setMuted(value){muted=Boolean(value);const button=document.getElementById('mute');button.textContent=muted?'🔇 Unmute':'🔊 Mute';button.setAttribute('aria-pressed',String(muted));if(runtime)runtime.setMuted?.(muted);}
async function start(){try{await restart();started=true;overlay.hidden=true;canvas.focus();}catch(error){status.textContent=error.message;}}
document.getElementById('begin').onclick=start;
document.getElementById('pause').onclick=pause;
document.getElementById('restart').onclick=()=>{if(started)void restart();};
document.getElementById('mute').onclick=()=>setMuted(!muted);
const normalize=key=>key.length===1?key.toLowerCase():key;
addEventListener('keydown',event=>{const key=normalize(event.key);if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(key))event.preventDefault();keys.add(key);if(!event.repeat){if(key==='Escape'||key==='p')pause();if(key==='r'&&started)void restart();}});
addEventListener('keyup',event=>keys.delete(normalize(event.key)));
addEventListener('blur',()=>{keys.clear();if(runtime)runtime.paused=true;});
function frame(now){const dt=Math.min((now-last)/1000||0,1/30);last=now;if(started){const input=new Set(keys);const pad=navigator.getGamepads?.()?.[0];if(pad){if(pad.axes[0]<-.2||pad.buttons[14]?.pressed)input.add('ArrowLeft');if(pad.axes[0]>.2||pad.buttons[15]?.pressed)input.add('ArrowRight');if(pad.buttons[0]?.pressed)input.add(' ');if(pad.buttons[2]?.pressed)input.add('x');const p=!!pad.buttons[9]?.pressed,r=!!pad.buttons[8]?.pressed;if(p&&!padPause)pause();if(r&&!padRestart)void restart();padPause=p;padRestart=r;}else{padPause=false;padRestart=false;}runtime.update(dt,input);runtime.render(context,canvas.width,canvas.height);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
`;
  // Escape literal HTML end tags in trusted app sources as well as project data.
  const script=('(()=>{\nconst __modules=Object.create(null);\n'+[...modules.values()].join('\n')+boot+'\n})();').replace(/<\/script/gi,'<\\/script');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlText(project.name)}</title><style>body{margin:0;background:#101720;color:#e4edce;font:16px system-ui;display:grid;place-content:center;min-height:100vh;text-align:center}canvas{display:block;width:min(96vw,1100px);max-height:80vh;object-fit:contain;image-rendering:pixelated}button{padding:12px 24px;margin:8px;cursor:pointer}#start{position:fixed;inset:0;background:#101720ed;display:grid;place-content:center}#start[hidden]{display:none}</style><canvas id="game" tabindex="0" aria-label="Game"></canvas><nav><button id="pause">Pause / Resume</button><button id="restart">Restart</button><button id="mute" aria-pressed="false">🔊 Mute</button></nav><p>Move: arrows / WASD · Jump: Space · Attack: X · Pause: Esc · Restart: R · Gamepad supported</p><div id="start"><h1>${htmlText(project.name)}</h1><button id="begin">Start game</button><p id="status" role="status"></p></div><script>${script}</script></html>`;
}
