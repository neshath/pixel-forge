#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
WORK="${RUNNER_TEMP}/pixel-forge-omarchy-runtime"
ISO_DIR="$WORK/iso"
ISO="$ISO_DIR/omarchy-4.0.4.iso"
HARNESS="$WORK/omarchy-iso"
OMARCHY="$WORK/omarchy"
PIXEL_FORGE_SHA="${PIXEL_FORGE_SHA:-51c724fc37bba733afe8811c846eed552fccb655}"
OMARCHY_ISO_URL="${OMARCHY_ISO_URL:-https://iso.omarchy.org/omarchy-4.0.4.iso}"
export PIXEL_FORGE_INSTALL=1

rm -rf "$WORK"
mkdir -p "$ISO_DIR"

curl -fsSLo "$ISO" "$OMARCHY_ISO_URL"
curl -fsSLo "$ISO.sha256" "$OMARCHY_ISO_URL.sha256"
cd "$ISO_DIR"
sha256sum -c "$ISO.sha256"

git clone --depth 1 --branch quattro https://github.com/omacom/omarchy-iso.git "$HARNESS"
chmod +x "$HARNESS/bin/omarchy-iso-test"

# The upstream harness normally installs host packages through omarchy-pkg-add.
# GitHub's Ubuntu runner gets those packages through apt in the workflow instead.
sudo tee /usr/local/bin/omarchy-pkg-add >/dev/null <<'EOF'
#!/bin/bash
exit 0
EOF
sudo chmod +x /usr/local/bin/omarchy-pkg-add

python3 - "$HARNESS/bin/omarchy-iso-test" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
anchor = '  log "Installed system is up. Saving base image."'
injection = '''  if [[ -n $PIXEL_FORGE_INSTALL ]]; then
      log "Installing Pixel Forge into the Omarchy base image"
      ssh_guest "echo $GUEST_PASSWORD | sudo -S pacman -S --noconfirm --needed base-devel git curl nodejs npm rust webkit2gtk-4.1 gtk3 pkgconf patchelf"
      ssh_guest "rm -rf /tmp/pixel-forge-build && mkdir -p /tmp/pixel-forge-build && curl -fsSL -o /tmp/pixel-forge-build/PKGBUILD https://raw.githubusercontent.com/neshath/pixel-forge/$PIXEL_FORGE_SHA/packaging/omarchy/PKGBUILD && cd /tmp/pixel-forge-build && makepkg --noconfirm -p PKGBUILD"
      ssh_guest "pkg=$(find /tmp/pixel-forge-build -maxdepth 1 -type f -name 'pixel-forge-0.1.0-1-*.pkg.tar.*' -print -quit); test -n \"$pkg\"; echo $GUEST_PASSWORD | sudo -S pacman -U --noconfirm \"$pkg\""
  fi

  log "Installed system is up. Saving base image."'''
if anchor not in text:
    raise SystemExit("Upstream omarchy-iso-test anchor changed; refusing to patch.")
path.write_text(text.replace(anchor, injection, 1))
PY

git clone --depth 1 --branch quattro https://github.com/omacom/omarchy.git "$OMARCHY"

mkdir -p "$OMARCHY/test/acceptance.d"
cat > "$OMARCHY/test/acceptance.d/pixel-forge-test.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/base-test.sh"

command -v hyprctl >/dev/null || fail "hyprctl is available"
command -v jq >/dev/null || fail "jq is available"
command -v grim >/dev/null || fail "grim is available"
pacman -Q pixel-forge >/dev/null 2>&1 || fail "Pixel Forge package is installed"
pass "Pixel Forge package is installed"

[[ -x /usr/bin/pixel-forge ]] || fail "Pixel Forge executable is present"
pass "Pixel Forge executable is present"

launch_app 'env GDK_BACKEND=wayland /usr/bin/pixel-forge >/tmp/pixel-forge.log 2>&1'

wait_until "Pixel Forge opens a Hyprland window" 45   bash -c 'hyprctl -j clients | jq -e '''[.[] | select((.class | test("pixel-forge"; "i")) and (.title == "Pixel Forge — Retro Game Studio"))] | length > 0''''

client="$(hyprctl -j clients | jq -e '[.[] | select((.class | test("pixel-forge"; "i")) and (.title == "Pixel Forge — Retro Game Studio"))][0]')"

echo "$client" | jq -e '(.xwayland // false) == false' >/dev/null ||
  fail "Pixel Forge is a native Wayland client"
pass "Pixel Forge is a native Wayland client"

echo "$client" | jq -e '.title == "Pixel Forge — Retro Game Studio"' >/dev/null ||
  fail "Pixel Forge window title is correct"
pass "Pixel Forge window title is correct"

pid="$(echo "$client" | jq -r '.pid // empty')"
[[ -n "$pid" ]] || fail "Hyprland exposes a Pixel Forge process id"
kill -0 "$pid" 2>/dev/null || fail "Pixel Forge remains alive after mapping"
pass "Pixel Forge remains alive after mapping"

grep -zq "WAYLAND_DISPLAY=" "/proc/$pid/environ" ||
  fail "Pixel Forge inherited a Wayland display"
pass "Pixel Forge inherited a Wayland display"

screenshot "success-pixel-forge-wayland-window"
screen_contains "WELCOME TO PIXEL FORGE" ||
  fail "Pixel Forge webview rendered its editor UI"
pass "Pixel Forge webview rendered its editor UI"

address="$(echo "$client" | jq -r '.address')"
hyprctl dispatch closewindow "address:$address" >/dev/null 2>&1 ||
  fail "Hyprland accepts Pixel Forge close request"
wait_until "Pixel Forge window closes cleanly" 20   bash -c 'hyprctl -j clients | jq -e '''[.[] | select(.address == "'"$address"'")] | length == 0''''
pass "Pixel Forge closes cleanly under Hyprland"
EOF
chmod +x "$OMARCHY/test/acceptance.d/pixel-forge-test.sh"

cd "$HARNESS"
./bin/omarchy-iso-test   "$ISO"   --no-preview   --sync-omarchy "$OMARCHY"   --memory 8192   --timeout 2400
