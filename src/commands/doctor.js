const fs = require('node:fs/promises');
const { pathInProject } = require('../lib/paths');
const { loadAtoms, validateAtoms } = require('../lib/atoms');
const { loadConfig } = require('../lib/config');
const { checkBrokenInstallLinks } = require('../lib/install');

async function checkDirectory(relativePath) {
  const full = pathInProject(relativePath);
  try {
    const st = await fs.stat(full);
    return st.isDirectory() ? null : `${relativePath}: directory ではありません`;
  } catch {
    return `${relativePath}: 見つかりません`;
  }
}

async function doctorCommand() {
  const targets = ['atoms', 'inbox', 'proposals', 'templates', 'dist', 'config', 'scripts'];
  const errors = [];
  const warnings = [];

  for (const dir of targets) {
    const err = await checkDirectory(dir);
    if (err) {
      errors.push(err);
    }
  }

  const schemaPath = pathInProject('atoms', 'schema.json');
  try {
    await fs.access(schemaPath);
  } catch {
    errors.push('atoms/schema.json: 見つかりません');
  }

  const { atoms, parseErrors } = await loadAtoms();
  for (const parseErr of parseErrors) {
    errors.push(parseErr);
  }

  const validation = validateAtoms(atoms);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  const config = await loadConfig();
  const brokenLinks = await checkBrokenInstallLinks(config);
  errors.push(...brokenLinks);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('[ai-rules] doctor: OK');
    console.log(`- atoms: ${validation.stats.count}`);
    return;
  }

  if (errors.length > 0) {
    console.log('[ai-rules] doctor: NG');
    for (const err of errors) {
      console.log(`- ${err}`);
    }
    process.exitCode = 1;
  } else {
    console.log('[ai-rules] doctor: WARN');
  }

  console.log(`- atoms: ${validation.stats.count}`);
  for (const warning of warnings) {
    console.log(`- WARN: ${warning}`);
  }
}

module.exports = {
  doctorCommand,
};
