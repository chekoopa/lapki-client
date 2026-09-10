const { chmodSync, existsSync } = require('fs');
const path = require('path');

/**
 * Windows bind mounts do not retain Unix modes.  electron-builder copies
 * unpacked resources before this hook, so set the mode on the final Linux
 * staging tree immediately before AppImage, Snap or DEB is created.
 */
exports.default = async (context) => {
  if (context.electronPlatformName !== 'linux') return;

  for (const relativePath of [
    'resources/app.asar.unpacked/resources/modules/linux/lapki-compiler/lapki-compiler',
    'resources/app.asar.unpacked/resources/modules/linux/sm-interpreter',
    'resources/app.asar.unpacked/resources/modules/linux/blg-mb/cyberbear-loader',
  ]) {
    const executablePath = path.join(context.appOutDir, relativePath);
    if (!existsSync(executablePath)) {
      throw new Error(`Required Linux module is missing from package: ${executablePath}`);
    }
    chmodSync(executablePath, 0o755);
  }

  for (const relativePath of [
    'resources/app.asar.unpacked/resources/toolchains/linux/arduino-cli/arduino-cli',
    'resources/app.asar.unpacked/resources/toolchains/linux/arduino-cli/arduino-cli.real',
    'resources/app.asar.unpacked/resources/toolchains/linux/make/make',
    'resources/app.asar.unpacked/resources/modules/linux/avrdude',
    'resources/app.asar.unpacked/resources/modules/linux/avrdude.real',
  ]) {
    const executablePath = path.join(context.appOutDir, relativePath);
    if (existsSync(executablePath)) chmodSync(executablePath, 0o755);
  }
};
