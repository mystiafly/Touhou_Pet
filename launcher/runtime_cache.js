'use strict';

const fs = require('fs');
const path = require('path');

async function ensureExtracted({ archive, target, isComplete, extract, validate }) {
  const readyFile = path.join(target, '.launcher-ready');
  if (fs.existsSync(readyFile) && isComplete(target)) return target;
  if (!fs.existsSync(archive)) throw new Error(`安装包缺少依赖缓存：${path.basename(archive)}`);

  const staging = `${target}.staging-${process.pid}`;
  await fs.promises.rm(staging, { recursive: true, force: true });
  try {
    await extract(archive, staging);
    if (!isComplete(staging)) throw new Error(`${path.basename(archive)} 解压不完整。`);
    if (validate) await validate(staging);
    await fs.promises.writeFile(path.join(staging, '.launcher-ready'), 'ready\n');
    if (fs.existsSync(target)) {
      const backup = `${target}.incomplete-${Date.now()}`;
      await fs.promises.rename(target, backup);
    }
    await fs.promises.rename(staging, target);
    return target;
  } catch (error) {
    await fs.promises.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { ensureExtracted };
