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
release_seafile_staging="${RELEASE_SEAFILE_STAGING:-0}"
project_root="$(pwd)"
linux_stage=""

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

verify_linux_package() {
  local package_root="$1"
  local unpacked_resources="$package_root/resources/app.asar.unpacked/resources"
  local gcc_path
  local windows_module_path
  local interpreter_path
  gcc_path="$(find "$package_root" -iname '*gcc-arm-none-eabi*' -print -quit)"
  if [[ -n "$gcc_path" ]]; then
    echo "Linux package unexpectedly contains an ARM GCC toolchain: $gcc_path" >&2
    exit 1
  fi
  windows_module_path="$(find "$unpacked_resources/modules/win32" -type f -print -quit 2>/dev/null || true)"
  if [[ -n "$windows_module_path" ]]; then
    echo "Linux package unexpectedly contains a Windows module: $windows_module_path" >&2
    exit 1
  fi
  interpreter_path="$unpacked_resources/modules/linux/sm-interpreter"
  if [[ ! -x "$interpreter_path" ]]; then
    echo "Linux package does not contain an executable sm-interpreter: $interpreter_path" >&2
    exit 1
  fi
}

cleanup_linux_stage() {
  if [[ -n "$linux_stage" ]]; then
    rm -rf -- "$linux_stage"
  fi
}

trap cleanup_linux_stage EXIT

if ! command -v zip >/dev/null; then
  apt-get update
  apt-get install --no-install-recommends -y zip
fi

if ! command -v rsync >/dev/null; then
  apt-get update
  apt-get install --no-install-recommends -y rsync
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

mkdir -p dist
# `dist` – именованный раздел Docker, где лежат релизы. 
# Перед сборкой нужно вычистить старые артефакты,
# а не то пакеты AppImage/Snap попадают в app.asar.
find dist -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
mkdir -p outputs
find outputs -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

npm ci
npm run build
npm run prepare:linux

# Сборка забирает всё, до чего доберётся, поэтому надёжнее 
# собирать под Linux из-под отдельной копии проекта.
linux_stage="$(mktemp -d)"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'outputs' \
  --exclude 'build/gcc-arm-none-eabi' \
  --exclude 'build/gcc-arm-none-eabi.zip' \
  --exclude 'resources/modules/win32' \
  --exclude 'resources/modules/darwin' \
  "$project_root/" "$linux_stage/"
# `/project` is commonly a Windows bind mount, where chmod is not preserved.
# The staging directory is native Linux storage, so make bundled executables
# runnable there before electron-builder copies them into the package.
chmod 755 \
  "$linux_stage/resources/modules/linux/lapki-compiler/lapki-compiler" \
  "$linux_stage/resources/modules/linux/sm-interpreter"
ln -s "$project_root/node_modules" "$linux_stage/node_modules"

pushd "$linux_stage" >/dev/null
for linux_target in $release_linux_targets; do
  npx electron-builder --linux "$linux_target" --config
  verify_linux_package "dist/linux-unpacked"
done
find dist -maxdepth 1 -type f -exec cp -a {} "$project_root/dist/" \;
popd >/dev/null
cleanup_linux_stage
linux_stage=""

npm run bundle:win

version="$(node -p 'require("./package.json").version')"
mkdir -p outputs/windows-release/setup_data/irpcb

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

rm -rf -- outputs/windows-release

if [[ "$release_seafile_staging" == "1" ]]; then
  mkdir -p outputs/seafile-upload
  cp "outputs/cyberiada-${version}-windows.zip" outputs/seafile-upload/
  find dist -maxdepth 1 -type f \( \
    -name '*.deb' -o -name '*.rpm' -o -name '*.snap' -o -name '*.AppImage' \
    \) -exec cp {} outputs/seafile-upload/ \;
fi

if [[ -n "${RELEASE_ARTIFACTS_DIR:-}" ]]; then
  mkdir -p "$RELEASE_ARTIFACTS_DIR/dist" "$RELEASE_ARTIFACTS_DIR/outputs"
  find dist -maxdepth 1 -type f -exec cp -a {} "$RELEASE_ARTIFACTS_DIR/dist/" \;
  cp -a outputs/. "$RELEASE_ARTIFACTS_DIR/outputs/"
fi
