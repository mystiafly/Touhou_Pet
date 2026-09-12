'use strict';

// Paths in this module are always relative to the mutable formal-program root.
// Keep this list conservative: anything not explicitly known to be user data is
// eligible for replacement during an update.
const PRESERVED_EXACT_PATHS = new Set([
  '.env',
  'services/global_config.json',
]);

const PRESERVED_PREFIXES = [
  'data/',
  'dependency-cache/',
  'launcher-state/',
];

const PRESERVED_CHARACTER_PATHS = [
  /^services\/characters\/[^/]+\/daily_history(?:\/|$)/,
  /^services\/characters\/[^/]+\/qdrant_db(?:\/|$)/,
  /^services\/characters\/[^/]+\/config\.json$/,
  /^services\/characters\/[^/]+\/(?:dialog_history(?:_[^/]+)?|favorability|databank_state|user_profile|scenario_state)\.json$/,
  /^services\/characters\/[^/]+\/presets\/(?:custom_presets|self_talk_presets)\.json$/,
];

function normalizeRelativePath(relativePath) {
  return String(relativePath || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

function isPreservedPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || normalized === '..' || normalized.startsWith('../')) {
    return false;
  }

  if (PRESERVED_EXACT_PATHS.has(normalized)) {
    return true;
  }
  if (PRESERVED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  return PRESERVED_CHARACTER_PATHS.some((pattern) => pattern.test(normalized));
}

function validateMatchingArtifacts(sourceManifest, backendManifest) {
  if (!sourceManifest || !backendManifest) {
    throw new Error('更新包缺少源码或后端清单。');
  }
  if (!sourceManifest.version || !sourceManifest.commit) {
    throw new Error('源码清单缺少版本或提交号。');
  }
  if (backendManifest.version !== sourceManifest.version) {
    throw new Error('源码与后端版本不匹配，已拒绝更新。');
  }
  if (backendManifest.source_commit !== sourceManifest.commit) {
    throw new Error('源码与后端提交不匹配，已拒绝更新。');
  }
  if (backendManifest.format !== 1) {
    throw new Error('后端更新包格式不受支持。');
  }
  return true;
}

module.exports = {
  PRESERVED_EXACT_PATHS,
  PRESERVED_PREFIXES,
  normalizeRelativePath,
  isPreservedPath,
  validateMatchingArtifacts,
};
