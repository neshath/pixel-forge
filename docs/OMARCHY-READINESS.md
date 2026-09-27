# Omarchy readiness

## Verified locally (macOS, 2026-09-26)

- Node regression suite: editor data, recovery/storage, original platformer behavior, overhead formats, bridge-to-exit traversal, water boundaries, solid landmarks.
- All eleven 2.5D pack palettes/materials/landmarks validate and serialize.
- Standalone HTML for platformer, top-down, and every pack compiles and starts without a server in a mocked DOM/Canvas harness. This is not a browser performance measurement.
- Native adapter cancellation, read, write, and error behavior pass using mocked Tauri APIs. Native command permissions explicitly enable read/write text commands; file paths are granted by user dialogs.
- Desktop frontend staging and PKGBUILD shell syntax checked.
- Browser QA: all eleven environment options loaded from the dropdown; each showed four themed materials plus its landmark set, with a refreshed Nightlotus thumbnail/map frame inspected at editor scale.

## Linux build gate

The Linux desktop checks workflow builds the Tauri binary on Ubuntu, validates the desktop entry, and uploads the binary. Passing CI is compilation proof, not Omarchy/Hyprland runtime proof. Check the run for the exact commit before downloading.

## Required before an Omarchy package submission

On a disposable, updated Omarchy installation:

1. Build packaging/PKGBUILD with makepkg -si as a non-root user with base-devel installed. Set PIXEL_FORGE_COMMIT to the tested full Git commit first. Record the resulting package version and dependencies.
2. Launch from the application menu and terminal. Verify the icon, window title, resizing, fullscreen, and keyboard focus after switching windows.
3. Test at 100%, 150%, and 200% display scale on Wayland/Hyprland. Record GPU, driver, monitor resolution and Hyprland version.
4. Open/save a project using native dialogs, including spaces and Unicode in filenames. Cancel both dialogs. Reopen saved data and check tile edits, props, audio, rules, and custom palettes.
5. Export HTML; open it offline in the target browser. Check play, pause, restart and completion in platformer, top-down and garden samples.
6. Run a large scene for at least 15 minutes, including animated water and many props. Record frame times/CPU/memory; check repeated play/stop cycles for growth. No performance target has yet been measured on Omarchy.
7. Preview imported audio and verify volume. Exercise Logic → Sound, scene music, mute/unmute, restart, and respawn. Browser codec/autoplay behavior still requires manual validation on the target browser.
8. Upgrade/reinstall the package; confirm saved projects survive. Uninstall using pacman and confirm executable/menu entry removal without deleting project files.

Do not describe this as officially accepted or supported by Omarchy. Package integration and upstream acceptance are separate from the editor's own repository.

## Current package gate

- Pixel Forge `main` currently passes the JavaScript CI suite, Linux desktop build checks, and Pages deployment for commit `31186c653db9a9e2d6a77c8a3034c5f9b4c88eac`.
- `packaging/omarchy/` contains a ready-to-copy Arch/Omarchy package candidate pinned to that commit.
- The package uses a pinned git source for the initial contribution because the project does not yet publish a tagged release. After the first tagged release, switch the recipe to an immutable release tarball with SHA-256 integrity data and add an Omarchy upstream watch.
- The remaining acceptance gate is real Omarchy/Hyprland installation and manual smoke testing; CI cannot establish that from Ubuntu.

## Known limits

- Bridges offer one walkable upper plane, not simultaneous under/over navigation.
- Packs are material/palette variants of a shared original procedural kit, not ten wholly independent sprite libraries.
- No native Linux/Hyprland session is available on the development Mac. Local free space was below 1 GiB, so no new heavyweight native toolchain/VM was installed.
- Fresh browser QA of the added packs was interrupted by the in-app browser's blocked cached connection-error page; automated rendering checks do not substitute for that visual pass.

Sources: [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/) and [filesystem default permissions](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/fs/permissions/default.toml).
