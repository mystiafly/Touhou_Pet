'use strict';

const fs = require('fs');
const path = require('path');
const { isPreservedPath } = require('./update_policy');

function isBundledCache(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  return normalized === 'dependency-cache' || normalized.startsWith('dependency-cache/') ||
    normalized === 'services/models' || normalized.startsWith('services/models/') ||
    normalized === 'dist/backend' || normalized.startsWith('dist/backend/') ||
    normalized === 'launcher-state' || normalized.startsWith('launcher-state/');
}

function hasRequiredSourceFiles(runtimeRoot) {
  return [
    'main.js',
    'services/web_interface.py',
    'services/global_config.json',
    'services/characters/rumia/config.json',
  ].every((relativePath) => fs.existsSync(path.join(runtimeRoot, relativePath)));
}

async function copySourceFiles(sourceRoot, targetRoot) {
  async function visit(relativePath) {
    if (isBundledCache(relativePath)) return;
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    const entry = await fs.promises.lstat(sourcePath);
    if (entry.isDirectory()) {
      await fs.promises.mkdir(targetPath, { recursive: true });
      for (const child of await fs.promises.readdir(sourcePath)) {
        await visit(path.join(relativePath, child));
      }
    } else if (entry.isFile()) {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
    }
  }
  for (const entry of await fs.promises.readdir(sourceRoot)) await visit(entry);
}

async function copyPreservedFiles(sourceRoot, targetRoot) {
  async function visit(relativePath) {
    if (isBundledCache(relativePath)) return;
    const sourcePath = path.join(sourceRoot, relativePath);
    const entry = await fs.promises.lstat(sourcePath);
    const targetPath = path.join(targetRoot, relativePath);
    if (entry.isDirectory()) {
      const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
      const isContainer = normalized === 'data' || normalized === 'services';
      if (isPreservedPath(relativePath) && !isContainer) {
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.cp(sourcePath, targetPath, { recursive: true, force: true });
        return;
      }
      for (const child of await fs.promises.readdir(sourcePath)) {
        await visit(path.join(relativePath, child));
      }
    } else if (entry.isFile() && isPreservedPath(relativePath)) {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
    }
  }
  for (const entry of await fs.promises.readdir(sourceRoot)) await visit(entry);
}

module.exports = { copySourceFiles, copyPreservedFiles, hasRequiredSourceFiles };
