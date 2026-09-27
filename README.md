<div align="center">

# ✦ Pixel Forge

### A tiny retro game studio for making big worlds, pixel by pixel.

**[▶ Launch Pixel Forge in your browser](https://neshath.github.io/pixel-forge/)**

[![Linux desktop checks](https://github.com/neshath/pixel-forge/actions/workflows/linux.yml/badge.svg)](https://github.com/neshath/pixel-forge/actions/workflows/linux.yml)
[![Platform](https://img.shields.io/badge/platform-Omarchy%20%2F%20Linux-ec6e88?style=for-the-badge&labelColor=30283a)](https://github.com/neshath/pixel-forge)
[![Runtime](https://img.shields.io/badge/runtime-browser%20%2B%20Tauri-5ec7d3?style=for-the-badge&labelColor=30283a)](https://github.com/neshath/pixel-forge)
[![License](https://img.shields.io/badge/license-MIT-e4edce?style=for-the-badge&labelColor=30283a)](LICENSE)

<img src="https://github-readme-stats.vercel.app/api/pin/?username=neshath&repo=pixel-forge&theme=radical&hide_border=true&show_owner=true" alt="Live Pixel Forge repository stats" width="420">

<br>

[![GitHub stars](https://img.shields.io/github/stars/neshath/pixel-forge?style=for-the-badge&logo=github&label=stars&color=f6c453&labelColor=30283a)](https://github.com/neshath/pixel-forge/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/neshath/pixel-forge?style=for-the-badge&logo=git&label=forks&color=a9e45e&labelColor=30283a)](https://github.com/neshath/pixel-forge/network/members)
[![Open issues](https://img.shields.io/github/issues/neshath/pixel-forge?style=for-the-badge&logo=github&label=issues&color=ec6e88&labelColor=30283a)](https://github.com/neshath/pixel-forge/issues)
[![Last commit](https://img.shields.io/github/last-commit/neshath/pixel-forge?style=for-the-badge&logo=git&label=updated&color=5ec7d3&labelColor=30283a)](https://github.com/neshath/pixel-forge/commits/main)

</div>

Pixel Forge is a **local-first retro game creation studio** for making small 2D games without an account, hosted backend, or heavyweight editor workflow. Draw terrain, place entities, make sprites, import audio, playtest immediately, and export a standalone HTML game.

The browser editor and native Linux desktop app share the same project model, renderer, runtime, and export path.

> **Current status:** The first playable editor/runtime slice is complete. The Tauri desktop shell builds successfully for Linux, and the project is being prepared for real Omarchy/Hyprland validation.

```js
const pixelForge = {
  mission: "Make something playable.",
  audience: "Curious game creators and pixel-art beginners",
  platforms: ["Browser", "Linux", "Omarchy", "Hyprland"],
  workflow: ["Draw", "Place", "Configure", "Playtest", "Export"],
  storage: "Local-first · portable .pixel.json projects",
  style: "Tactile 1990s workstation with original pixel motifs",
  currentFocus: "Audio reliability and Omarchy validation",
  funFact: "Every visible tool is meant to do something."
};
```

## ✦ What you can do right now

| Area | Capabilities |
|---|---|
| **World building** | Paint, erase, fill, draw rectangles and lines, eyedrop tiles, pan, zoom, show grids, edit collisions, and compose camera bounds. |
| **Scenes and layers** | Create, duplicate, rename, reorder, lock, hide, and delete scenes and layers. Configure game formats, environments, and HUD settings. |
| **Entities** | Place players, enemies, gems, health, checkpoints, doors, platforms, bosses, NPCs, triggers, hazards, emitters, and other supported objects. |
| **Gameplay** | Move, jump, attack, collect items, take damage, respawn at checkpoints, open doors, pause, restart, mute or unmute audio, and complete stages. |
| **Sprites** | Draw 8/16/24/32/64 px sprites, edit palettes, duplicate frames, set timing, use onion skinning, preview loop/ping-pong/one-shot animation, and import/export PNG sheets. |
| **Audio v1** | Import sound effects and music, preview them, toggle looping per asset, and delete assets with undo support. |
| **Logic** | Create visual event rules for switches, doors, dialogue, scenes, camera changes, sounds, messages, animation, items, checkpoints, and boss phases. |
| **Projects** | Save and reopen portable `.pixel.json` projects, recover browser autosaves, keep large audio payloads in IndexedDB, browse versions, manage folders, and export standalone HTML games. |
| **Exchange** | Work with source-included local packages, author/license/source metadata, editable forks, attribution, recoverable local libraries, and read-only HTTPS catalogs. |
| **Editor feel** | Collapsible and resizable panels, persistent layout settings, keyboard shortcuts, classic Pixel Forge skin, and optional Pixel Playground skin. |

## ◈ The workflow

```text
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  1. DRAW     │ ──▶ │  2. PLACE   │ ──▶ │  3. CONFIGURE│
│  terrain     │     │  entities   │     │  rules + HUD │
└──────────────┘     └─────────────┘     └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  6. SHARE     │ ◀── │  5. EXPORT  │ ◀── │  4. PLAYTEST │
│  project file │     │  HTML game  │     │  immediately │
└──────────────┘     └─────────────┘     └──────────────┘
```

1. Choose **New empty project**, or explore the labeled **Moonfern sample**.
2. Open **Tiles**, choose a tile, and paint with Pencil, Eraser, Fill, Rectangle, Line, or Eyedropper.
3. Open **Entities**, choose a supported object, and click the map to place it.
4. Use **Select** to move and inspect entities. Configure transforms, artwork, movement, health, damage, paths, and destinations in the Inspector.
5. Open **♫ Audio** to import small sound effects or music files. Use native preview controls and enable **Loop** for music.
6. Press **Playtest**. Default controls are arrows or A/D to move, Space to jump, X to attack, Esc to pause, and R to restart.
7. Use **Save** to download an editable `.pixel.json` project, **Open project** to restore one, and **Export game** to download a standalone HTML game for the active scene.

Playtest uses an isolated runtime scene, so gameplay changes such as enemy damage, pickups, deaths, and checkpoints do not mutate the editable scene.

## ♫ Audio v1

The first audio slice is deliberately small and portable:

- Import one or multiple sound effects.
- Import one or multiple music files.
- Preview imported files with native audio controls.
- Toggle looping per asset; music is enabled for looping by default.
- Assign music to scenes and trigger sounds through visual logic rules.
- Play audio during editor playtests and in exported standalone HTML games.
- Mute or unmute all active and future runtime audio from the gameplay screen.
- Delete assets with undo support.
- Store audio inside the project JSON for portability.

Limits for this first slice:

- **4 MB** maximum per audio file.
- **8 MB** maximum audio library per project.
- Browser playback depends on the browser’s supported audio codecs and user-gesture autoplay rules.
- Automated tests cover runtime audio wiring and export boot behavior; real browser codec playback still needs manual smoke validation.

## ⌘ Browser quick start

Requires **Node.js 20 or newer**. No production dependency-install step is needed.

```sh
git clone https://github.com/neshath/pixel-forge.git
cd pixel-forge
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The default server listens only on loopback and is intended for local development.

For an explicitly public preview on a trusted network or sandbox, opt in to a non-loopback host and a separate port:

```sh
HOST=0.0.0.0 PORT=4174 npm start
```

Do not use that command on an untrusted network without a firewall or access-control layer.

## ▣ Linux desktop build

The Tauri desktop build embeds the same web editor and runs without a local development server. It provides native Open, Save, and Export dialogs.

On Arch Linux or Omarchy, install the build prerequisites:

```sh
sudo pacman -Syu
sudo pacman -S --needed nodejs npm rust cargo webkit2gtk-4.1 \
  lib32-webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg patchelf
```

Build the native application:

```sh
npm install
RUSTUP_TOOLCHAIN=stable npm run desktop:build
```

Build outputs:

```text
src-tauri/target/release/pixel-forge
src-tauri/target/release/bundle/appimage/Pixel Forge_0.1.0_amd64.AppImage
src-tauri/target/release/bundle/deb/Pixel Forge_0.1.0_amd64.deb
```

For Omarchy, prefer the **AppImage** or the included Arch **PKGBUILD** path. The `.deb` is primarily for Debian- or Ubuntu-based systems and is not the native Omarchy package format.

If WebKitGTK renders a blank or corrupted view, retry with:

```sh
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./src-tauri/target/release/pixel-forge
```

Final Wayland/Hyprland validation still needs to happen on a real Omarchy installation. The sandbox validates Linux compilation and X11 launch behavior, but it is not an Omarchy/Hyprland test machine.

## ◇ Project and Exchange model

Pixel Forge is designed around portable, inspectable files:

- Source-included local packages.
- Author, license, and source metadata.
- Editable forks with attribution.
- Recoverable local library and project version history.
- Read-only HTTPS catalog fetching.
- Browser autosave and validated portable project files.

The Exchange is **not** a hosted publishing service yet. A public catalog, accounts, moderation, reporting, ratings, package updates, and online submission flow remain future work.

## ⚙ Verification

Run the automated suite:

```sh
npm test
```

The current suite contains **65 automated tests** covering:

- Project round trips and extended validation.
- Invalid file rejection and storage recovery.
- Undo/redo isolation.
- Terrain operations, collision behavior, and one-way platforms.
- Runtime movement, collectibles, checkpoints, respawn, pause, and completion.
- Export bundling and offline startup.
- Marketplace package validation.
- Native file bridge configuration.
- Audio asset round trips, runtime lookup, scene music, export boot/restart behavior, and audio-data validation.

Browser smoke checks cover editor startup, painting/history, layout controls, project workflows, the Audio tab, marketplace views, and playtest entry.

## ✎ Source map

```text
src/model.js            project model, validation, scenes, entities, assets, rules
src/render.js           Canvas rendering for scenes, entities, tiles, overlays
src/runtime.js          isolated gameplay simulation and runtime rendering
src/app.js              editor state, input, autosave, files, audio, export
src/editor-panels.js    Inspector, asset libraries, Audio, HUD, logic, files
src/workbench.js        tabs, Exchange integration, responsive editor behavior
src/platform.js         browser/native file bridge
src-tauri/              native Linux desktop shell and capabilities
packaging/              desktop entry and Arch packaging metadata
tests/                  model, runtime, storage, export, platform, marketplace, audio
```

## ◌ Roadmap

1. Validate AppImage and Arch packages on real Omarchy/Hyprland hardware.
2. Run real browser audio smoke tests across MP3, WAV, OGG where supported, scene switching, mute, and restart/respawn.
3. Improve multi-selection, autotiling, slopes, animation timelines, camera editing, sprite workflows, and complete undo coverage.
4. Add richer runtime systems: advanced enemy AI, bosses, moving platforms, particles, transitions, and more hazards.
5. Add CI, reproducible release artifacts, release documentation, screenshots, and demo media.
6. Build hosted community marketplace infrastructure separately from the local editor.
7. Expand beginner mode, accessibility, guided tutorials, safer destructive actions, and child-friendly workflows.

Pixel Forge is ready for experimentation, prototyping, and early community review. It is not yet a complete commercial-grade game engine or online publishing platform.

## License

Pixel Forge is released under the [MIT License](LICENSE).

<div align="center">

**Make games. Pixel by pixel.**

[Repository](https://github.com/neshath/pixel-forge) · [Issues](https://github.com/neshath/pixel-forge/issues) · [License](LICENSE)

</div>
