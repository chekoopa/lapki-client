#!/usr/bin/env bash
set -euo pipefail

# Creates the Arduino CLI data directory which is bundled with one platform's
# application. The target's CLI downloads host-specific AVR tools, therefore
# Linux and Windows data must be prepared separately.
platform="${1:?Usage: $0 <linux|win32> [arduino-cli command...] }"
shift
if [[ "$#" -eq 0 ]]; then
  cli=(arduino-cli)
else
  cli=("$@")
fi
core="arduino:avr@1.8.8"
data_root="resources/arduino-cli-data/$platform"
marker="$data_root/.lapki-arduino-avr-core-version"
cli_data_dir="${ARDUINO_CLI_DATA_DIR:-$PWD/$data_root}"

case "$platform" in
  linux|win32) ;;
  *) echo "Unsupported Arduino core platform: $platform" >&2; exit 1 ;;
esac

if [[ -f "$marker" ]] && [[ "$(<"$marker")" == "$core" ]]; then
  exit 0
fi

rm -rf -- "$data_root"
mkdir -p "$data_root"
ARDUINO_DIRECTORIES_DATA="$cli_data_dir" "${cli[@]}" core update-index
ARDUINO_DIRECTORIES_DATA="$cli_data_dir" "${cli[@]}" core install "$core"
printf '%s\n' "$core" > "$marker"
# Download archives are not needed by the installed core and inflate releases.
rm -rf -- "$data_root/staging"
