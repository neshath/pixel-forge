/**
 * Small platform boundary shared by browser development mode and the Tauri build.
 * The editor, project format, renderer, and runtime do not depend on Tauri.
 */
export const isDesktop = Boolean(globalThis.__TAURI_INTERNALS__ || globalThis.__TAURI__);

function tauriModules() {
  const tauri = globalThis.__TAURI__;
  if (!tauri?.dialog?.open || !tauri.dialog.save || !tauri.fs?.readTextFile || !tauri.fs.writeTextFile) {
    throw Error('Native Tauri file APIs are unavailable. Rebuild the desktop app with Tauri globals enabled.');
  }
  return {open: tauri.dialog.open, save: tauri.dialog.save, readTextFile: tauri.fs.readTextFile, writeTextFile: tauri.fs.writeTextFile};
}

export async function openProjectFile(browserInput) {
  if (isDesktop) {
    const {open, readTextFile} = tauriModules();
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{name: 'Pixel Forge project', extensions: ['json', 'pixel.json']}]
    });
    if (!path || Array.isArray(path)) return null;
    return {name: path.split(/[\\/]/).pop() || 'project.pixel.json', text: await readTextFile(path)};
  }
  browserInput.click();
  return null;
}

export async function saveProjectFile(data, suggestedName, mime = 'application/json') {
  if (isDesktop) {
    const {save, writeTextFile} = tauriModules();
    const path = await save({
      defaultPath: suggestedName,
      filters: [{name: mime === 'text/html' ? 'HTML game' : 'Pixel Forge project', extensions: [mime === 'text/html' ? 'html' : 'pixel.json']}]
    });
    if (!path) return false;
    await writeTextFile(path, data);
    return true;
  }
  const url = URL.createObjectURL(new Blob([data], {type: mime}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}
