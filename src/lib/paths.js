const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function detectMode() {
  const aiRulesDir = path.join(process.cwd(), '.ai-rules');
  try {
    fs.statSync(aiRulesDir);
    return { type: 'project', root: process.cwd() };
  } catch {
    // not a project directory
  }

  const fromEnv = process.env.AI_RULES_ROOT;
  if (fromEnv) {
    return { type: 'global', root: path.resolve(fromEnv) };
  }

  const defaultGlobal = path.join(os.homedir(), '.config', 'ai-rules');
  try {
    fs.statSync(defaultGlobal);
    return { type: 'global', root: defaultGlobal };
  } catch {
    // not found
  }

  return { type: 'global', root: process.cwd() };
}

function getProjectRoot() {
  const mode = detectMode();
  return mode.root;
}

function pathInProject(...segments) {
  return path.join(getProjectRoot(), ...segments);
}

module.exports = {
  detectMode,
  getProjectRoot,
  pathInProject,
};
