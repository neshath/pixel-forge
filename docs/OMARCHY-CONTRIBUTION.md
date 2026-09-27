# Omarchy community package

This directory contains an Omarchy/Arch package candidate for Pixel Forge.

## Current source

The package is pinned to verified Pixel Forge commit `31186c653db9a9e2d6a77c8a3034c5f9b4c88eac`.

The package intentionally uses a pinned git source for the first community submission because Pixel Forge does not yet publish a tagged GitHub release. Once the first release tag exists, the recipe should move to an immutable release tarball plus SHA-256 integrity data and an Omarchy upstream watch.

## Local build

On Arch Linux or Omarchy:

```sh
sudo pacman -S --needed base-devel git nodejs npm rust webkit2gtk-4.1 pkgconf patchelf
makepkg -si
```

The package installs:

- `/usr/bin/pixel-forge`
- `/usr/share/applications/pixel-forge.desktop`
- `/usr/share/icons/hicolor/256x256/apps/pixel-forge.png`
- `/usr/share/licenses/pixel-forge/LICENSE`

## Verification

After installation, verify the application launches from both the application menu and terminal, native project dialogs work, editor/playtest/export flows work, and the UI behaves correctly under Wayland/Hyprland.

The repository's Linux CI validates the Tauri build, desktop entry, package recipe syntax, and test suite. It does not replace a real Omarchy/Hyprland smoke test.

## Upstream contribution

The Omarchy package repository currently keeps packages under `pkgbuilds/<package>/` with `.omarchy/package.json` metadata. This folder is structured to be copied into that repository as:

```
pkgbuilds/pixel-forge/
  PKGBUILD
  .omarchy/package.json
```

Omarchy maintainers own checked-in package recipes, so the contribution should keep packaging changes in the Omarchy package repository rather than coupling package updates to the Pixel Forge source repository.
