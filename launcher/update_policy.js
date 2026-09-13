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
  'services/models/',
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

module.exports = {
  PRESERVED_EXACT_PATHS,
  PRESERVED_PREFIXES,
  normalizeRelativePath,
  isPreservedPath,
};
