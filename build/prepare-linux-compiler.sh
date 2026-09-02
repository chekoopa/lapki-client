#!/usr/bin/env bash
set -euo pipefail

# The Linux compiler binary is maintained directly as an Electron resource,
# like the other Linux modules.  Stage only its data next to that binary.
# The compiler source tree is excluded by electron-builder, so the installed
# package contains this data set only once.
source_root="build/lapki-compiler/compiler"
target_root="resources/modules/linux/lapki-compiler"
binary_path="$target_root/lapki-compiler"

for required_path in \
  "$binary_path" \
  "$source_root/library" \
  "$source_root/platforms" \
  "$source_root/fullgraphmlparser/templates"; do
  if [[ ! -e "$required_path" ]]; then
    echo "Required Linux compiler resource is missing: $required_path" >&2
    echo "Place the Linux lapki-compiler binary in $target_root first." >&2
    exit 1
  fi
done

install -d "$target_root/fullgraphmlparser"
rm -rf -- \
  "$target_root/library" \
  "$target_root/platforms" \
  "$target_root/fullgraphmlparser/templates"
cp -a "$source_root/library" "$target_root/library"
cp -a "$source_root/platforms" "$target_root/platforms"
cp -a "$source_root/fullgraphmlparser/templates" "$target_root/fullgraphmlparser/templates"
