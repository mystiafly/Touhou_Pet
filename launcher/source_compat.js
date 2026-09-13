'use strict';

const fs = require('fs');
const path = require('path');

function patchSourceBackendEntryPoint(sourceRoot) {
  const mainPath = path.join(sourceRoot, 'main.js');
  if (!fs.existsSync(mainPath)) throw new Error('源码包缺少 main.js。');
  let source = fs.readFileSync(mainPath, 'utf8');
  if (source.includes('RUMIA_LAUNCHER_BACKEND_V2')) return;

  const marker = 'function startBackendService(force = false) {';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('源码包的后端启动入口无法识别，已停止安装以避免启动半成品。');

  const previousStart = source.indexOf("    if (process.env.RUMIA_SOURCE_BACKEND === '1') {", markerIndex);
  const originalBranch = source.indexOf('    if (!app.isPackaged &&', markerIndex);
  if (previousStart >= 0 && originalBranch > previousStart) {
    source = source.slice(0, previousStart) + source.slice(originalBranch);
  } else if (source.includes('RUMIA_SOURCE_BACKEND')) {
    return;
  }

  const compatibility = `${marker}\n` +
    `    // RUMIA_LAUNCHER_BACKEND_V2\n` +
    `    if (process.env.RUMIA_SOURCE_BACKEND === '1') {\n` +
    `        if (backendSpawning || (backendProcess && backendProcess.exitCode === null)) return;\n` +
    `        backendSpawning = true;\n` +
    `        const { spawn } = require('child_process');\n` +
    `        const pythonPath = resolvePythonPath();\n` +
    `        logDebug(\`[LAUNCHER] 使用固定 Python 环境启动源码后端: \${pythonPath}\`);\n` +
    `        const backendLog = process.env.RUMIA_LAUNCHER_BACKEND_LOG;\n` +
    `        const logFd = backendLog ? fs.openSync(backendLog, 'a') : null;\n` +
    `        backendProcess = spawn(pythonPath, ['services/web_interface.py'], {\n` +
    `            cwd: __dirname,\n` +
    `            windowsHide: true,\n` +
    `            stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],\n` +
    `            env: process.env\n` +
    `        });\n` +
    `        if (logFd !== null) fs.closeSync(logFd);\n` +
    `        backendProcess.on('error', (error) => {\n` +
    `            logDebug(\`[LAUNCHER] 源码后端启动失败: \${error.message}\`);\n` +
    `            backendProcess = null;\n` +
    `            backendSpawning = false;\n` +
    `        });\n` +
    `        backendProcess.on('exit', (code) => {\n` +
    `            logDebug(\`[LAUNCHER] 源码后端退出，退出码: \${code}\`);\n` +
    `            backendProcess = null;\n` +
    `            backendSpawning = false;\n` +
    `        });\n` +
    `        return;\n` +
    `    }`;
  source = source.replace(marker, compatibility);
  const temporaryPath = `${mainPath}.launcher-tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, source, 'utf8');
  fs.renameSync(temporaryPath, mainPath);
}

module.exports = { patchSourceBackendEntryPoint };
