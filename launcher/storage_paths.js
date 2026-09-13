'use strict';

const path = require('path');

function getLauncherStorageRoot({ isPackaged, executablePath, appPath, override } = {}) {
  if (override) return path.resolve(override);
  if (isPackaged && executablePath) return path.dirname(executablePath);
  return path.join(path.dirname(appPath || process.cwd()), '.rumia-launcher-data');
}

module.exports = { getLauncherStorageRoot };
