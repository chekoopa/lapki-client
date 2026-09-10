#!/usr/bin/env bash
set -euo pipefail

# Linux module executables are maintained directly as Electron resources.
# Stage only compiler data next to its binary.  The compiler source tree is
# excluded by electron-builder, so the installed package contains this data
# set only once.
source_root="build/lapki-compiler/compiler"
target_root="resources/modules/linux/lapki-compiler"
binary_path="$target_root/lapki-compiler"
interpreter_path="resources/modules/linux/sm-interpreter"
flasher_library_root="resources/modules/linux/lib"

for required_path in \
  "$binary_path" \
  "$interpreter_path" \
  "$source_root/library" \
  "$source_root/platforms" \
  "$source_root/fullgraphmlparser/templates"; do
  if [[ ! -e "$required_path" ]]; then
    echo "Required Linux module resource is missing: $required_path" >&2
    echo "Place the Linux module binaries in resources/modules/linux first." >&2
    exit 1
  fi
done

# A bind mount from Windows does not preserve the executable bit.  Set it in
# the Linux build environment so both unpacked applications and packages can
# spawn the bundled modules.
chmod 755 "$binary_path" "$interpreter_path"

# Strict Snap does not expose the host's libusb to lapki-flasher.  Bundle the
# ABI-compatible shared object next to the Linux modules; ModuleManager adds
# this directory only to the flasher's dynamic-library search path.
echo '[prepare:linux] Preparing bundled libusb...'
libusb_path="${LAPKI_LIBUSB_PATH:-}"
if [[ -z "$libusb_path" ]]; then
  libusb_path="$(ldconfig -p 2>/dev/null | awk '/libusb-1\.0\.so\.0/ { print $NF; exit }')"
fi
if [[ -z "$libusb_path" ]] || [[ ! -f "$libusb_path" ]]; then
  echo 'libusb-1.0.so.0 is required to package lapki-flasher for Linux.' >&2
  exit 1
fi
install -d "$flasher_library_root"
install -m 755 "$libusb_path" "$flasher_library_root/libusb-1.0.so.0"

echo '[prepare:linux] Copying compiler data...'
install -d "$target_root/fullgraphmlparser"
rm -rf -- \
  "$target_root/library" \
  "$target_root/platforms" \
  "$target_root/fullgraphmlparser/templates"
cp -a "$source_root/library" "$target_root/library"
cp -a "$source_root/platforms" "$target_root/platforms"
cp -a "$source_root/fullgraphmlparser/templates" "$target_root/fullgraphmlparser/templates"
echo '[prepare:linux] Compiler data is ready.'
