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
  ]) {
    const executablePath = path.join(context.appOutDir, relativePath);
    if (!existsSync(executablePath)) {
      throw new Error(`Required Linux module is missing from package: ${executablePath}`);
    }
    chmodSync(executablePath, 0o755);
  }
};
