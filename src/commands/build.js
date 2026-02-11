const { loadAtoms, validateAtoms } = require('../lib/atoms');
const { loadConfig, loadProjectConfig } = require('../lib/config');
const { buildTargets, buildProjectTargets } = require('../lib/build');
const { detectMode } = require('../lib/paths');

async function buildCommand() {
  const mode = detectMode();

  if (mode.type === 'project') {
    await buildProjectMode(mode.root);
  } else {
    await buildGlobalMode();
  }
}

async function buildGlobalMode() {
  const config = await loadConfig();
  const { atoms, parseErrors } = await loadAtoms();
  if (parseErrors.length > 0) {
    throw new Error(`atoms の読み込みに失敗しました: ${parseErrors.join('; ')}`);
  }

  const validation = validateAtoms(atoms);
  if (validation.errors.length > 0) {
    throw new Error(`atoms の検証エラー: ${validation.errors.join('; ')}`);
  }

  const result = await buildTargets({
    atomsWithFile: atoms,
    enabledTargets: config.targets.enabled,
  });

  console.log('[ai-rules] build completed (global)');
  console.log(`- atoms: ${result.atomsCount}`);
  console.log(`- targets: ${config.targets.enabled.join(', ')}`);
  for (const out of result.outputs) {
    console.log(`- output: ${out}`);
  }

  for (const warning of validation.warnings) {
    console.log(`- WARN: ${warning}`);
  }
}

async function buildProjectMode(projectRoot) {
  const projectConfig = await loadProjectConfig(projectRoot);
  if (!projectConfig) {
    throw new Error('.ai-rules/config.yaml が見つかりません。ai-rules init を実行してください。');
  }

  const result = await buildProjectTargets({
    projectRoot,
    source: projectConfig.source,
    enabledTargets: projectConfig.targets.enabled,
  });

  console.log('[ai-rules] build completed (project)');
  console.log(`- source: ${projectConfig.source}`);
  console.log(`- targets: ${projectConfig.targets.enabled.join(', ')}`);
  for (const out of result.outputs) {
    console.log(`- output: ${out}`);
  }
}

module.exports = {
  buildCommand,
};
