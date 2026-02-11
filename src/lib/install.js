const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathInProject } = require('./paths');
const { TARGET_DIST_MAP } = require('./build');

function expandHomePath(input) {
  if (input === '~') {
    return os.homedir();
  }
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function distPathForTarget(target) {
  const rel = TARGET_DIST_MAP[target];
  if (!rel) {
    return '';
  }
  return pathInProject(rel);
}

function distPathForProjectTarget(projectRoot, target) {
  const rel = TARGET_DIST_MAP[target];
  if (!rel) {
    return '';
  }
  return path.join(projectRoot, '.ai-rules', rel);
}

function resolveDestination(dest, projectRoot) {
  if (dest.startsWith('~/')) {
    return expandHomePath(dest);
  }
  if (dest.startsWith('./') || dest.startsWith('../') || !path.isAbsolute(dest)) {
    return path.resolve(projectRoot, dest);
  }
  return dest;
}

function resolveInstallItems(config) {
  const enabledTargets = config.targets?.enabled || [];
  const destinations = config.install?.destinations || {};

  return enabledTargets
    .map((target) => ({
      target,
      source: distPathForTarget(target),
      destination: expandHomePath(String(destinations[target] || '')),
    }))
    .filter((item) => item.source && item.destination);
}

function resolveProjectInstallItems({ projectRoot, enabledTargets, destinations }) {
  return enabledTargets
    .map((target) => {
      const dest = destinations[target];
      if (!dest) {
        return null;
      }
      return {
        target,
        source: distPathForProjectTarget(projectRoot, target),
        destination: resolveDestination(dest, projectRoot),
      };
    })
    .filter((item) => item && item.source && item.destination);
}

function timestampForBackup() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function ensureConflictHandled(destination, onConflict, backupDir) {
  try {
    await fs.lstat(destination);
  } catch {
    return { skipped: false, backupPath: '' };
  }

  if (onConflict === 'overwrite') {
    await fs.rm(destination, { recursive: true, force: true });
    return { skipped: false, backupPath: '' };
  }

  if (onConflict === 'backup') {
    const basename = path.basename(destination);
    const ts = timestampForBackup();
    const backupPath = backupDir
      ? path.join(backupDir, `${basename}.${ts}.bak`)
      : `${destination}.bak`;
    if (backupDir) {
      await fs.mkdir(backupDir, { recursive: true });
    }
    await fs.rename(destination, backupPath);
    return { skipped: false, backupPath };
  }

  return { skipped: true, backupPath: '' };
}

async function installOne({ source, destination, mode, onConflict, backupDir }) {
  try {
    await fs.access(source);
  } catch {
    return { status: 'skipped', reason: 'not-built', destination };
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });

  let existingLinkTarget = '';
  try {
    const st = await fs.lstat(destination);
    if (st.isSymbolicLink()) {
      existingLinkTarget = await fs.readlink(destination);
      const resolvedLink = path.resolve(path.dirname(destination), existingLinkTarget);
      if (resolvedLink === source) {
        return { status: 'skipped', reason: 'already-linked', destination };
      }
    }
  } catch {
    // no-op
  }

  const conflict = await ensureConflictHandled(destination, onConflict, backupDir);
  if (conflict.skipped) {
    return { status: 'skipped', reason: 'conflict', destination };
  }

  if (mode === 'copy') {
    await fs.copyFile(source, destination);
    return {
      status: 'installed',
      mode: 'copy',
      source,
      destination,
      backupPath: conflict.backupPath,
    };
  }

  await fs.symlink(source, destination);
  return {
    status: 'installed',
    mode: 'symlink',
    source,
    destination,
    backupPath: conflict.backupPath,
  };
}

async function checkBrokenInstallLinks(config) {
  const items = resolveInstallItems(config);
  const errors = [];

  for (const item of items) {
    try {
      const st = await fs.lstat(item.destination);
      if (!st.isSymbolicLink()) {
        continue;
      }
      const rawLink = await fs.readlink(item.destination);
      const resolved = path.resolve(path.dirname(item.destination), rawLink);
      try {
        await fs.access(resolved);
      } catch {
        errors.push(`install リンク切れ: ${item.destination} -> ${resolved}`);
      }
    } catch {
      // destination not installed yet is acceptable
    }
  }

  return errors;
}

module.exports = {
  resolveInstallItems,
  resolveProjectInstallItems,
  installOne,
  checkBrokenInstallLinks,
};
