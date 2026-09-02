#!/usr/bin/env bash
set -euo pipefail

# This is the common release body used both locally in Docker and by GitHub
# Actions.  Downloads may be overridden with version-pinned URLs in CI.
avrdude_url="${AVRDUDE_URL:-https://github.com/avrdudes/avrdude/releases/download/v8.0/avrdude-v8.0-windows-x86.zip}"
arduino_cli_url="${ARDUINO_CLI_URL:-https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_Windows_64bit.zip}"
arm_gcc_url="${ARM_GCC_URL:-https://seafile.polyus-nt.ru/f/83d0be836d1c491fa3b3/?dl=1}"
irpcb_url="${IRPCB_URL:-https://seafile.polyus-nt.ru/f/6377a640bc344e31bd6d/?dl=1}"
release_download_cache="${RELEASE_DOWNLOAD_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/lapki-release}"
release_linux_targets="${RELEASE_LINUX_TARGETS:-AppImage snap deb}"

download() {
  local url="$1"
  local target="$2"
  local cache_key
  local cache_file
  cache_key="$(printf '%s' "$url" | sha256sum | awk '{print $1}')"
  cache_file="$release_download_cache/$cache_key"

  mkdir -p "$release_download_cache"
  if [[ ! -f "$cache_file" ]]; then
    wget --https-only --no-verbose --output-document="$cache_file.part" "$url"
    mv "$cache_file.part" "$cache_file"
  fi
  cp "$cache_file" "$target"
}

if ! command -v zip >/dev/null; then
  apt-get update
  apt-get install --no-install-recommends -y zip
fi

if [[ "${RELEASE_SKIP_DOWNLOADS:-0}" != "1" ]]; then
  mkdir -p resources/modules/win32/arduino-cli build
  download "$avrdude_url" resources/modules/win32/avrdude.zip
  unzip -oq resources/modules/win32/avrdude.zip -d resources/modules/win32
  rm -f resources/modules/win32/avrdude.zip

  download "$arduino_cli_url" resources/modules/win32/arduino-cli.zip
  unzip -oq resources/modules/win32/arduino-cli.zip -d resources/modules/win32/arduino-cli
  rm -f resources/modules/win32/arduino-cli.zip

  download "$arm_gcc_url" build/gcc-arm-none-eabi.zip

  download "$irpcb_url" build/irpcb.zip
  unzip -oq build/irpcb.zip -d build/irpcb
  rm -f build/irpcb.zip
fi

npm ci
npm run build
npm run prepare:linux
for linux_target in $release_linux_targets; do
  npx electron-builder --linux "$linux_target" --config
done
npm run bundle:win

version="$(node -p \"require('./package.json').version\")"
mkdir -p outputs/seafile-upload outputs/windows-release/setup_data/irpcb

cp dist/*-setup.exe outputs/windows-release/
cp build/gcc-arm-none-eabi.zip outputs/windows-release/setup_data/gcc-arm-none-eabi.zip
cp -r build/irpcb/bin outputs/windows-release/setup_data/irpcb/bin

mkdir -p outputs/windows-release/setup_data/lapki-compiler/fullgraphmlparser
cp -r build/lapki-compiler/compiler/library outputs/windows-release/setup_data/lapki-compiler/library
cp -r build/lapki-compiler/compiler/platforms outputs/windows-release/setup_data/lapki-compiler/platforms
cp -r build/lapki-compiler/compiler/fullgraphmlparser/templates \
  outputs/windows-release/setup_data/lapki-compiler/fullgraphmlparser/templates

(
  cd outputs/windows-release
  zip -qr "../cyberiada-${version}-windows.zip" .
)

cp "outputs/cyberiada-${version}-windows.zip" outputs/seafile-upload/
find dist -maxdepth 1 -type f \( \
  -name '*.deb' -o -name '*.rpm' -o -name '*.snap' -o -name '*.AppImage' \
  \) -exec cp {} outputs/seafile-upload/ \;

if [[ -n "${RELEASE_ARTIFACTS_DIR:-}" ]]; then
  mkdir -p "$RELEASE_ARTIFACTS_DIR/dist" "$RELEASE_ARTIFACTS_DIR/outputs"
  find dist -maxdepth 1 -type f -exec cp -a {} "$RELEASE_ARTIFACTS_DIR/dist/" \;
  cp -a outputs/. "$RELEASE_ARTIFACTS_DIR/outputs/"
fi
