const { loadAtoms, validateAtoms } = require('../lib/atoms');
const { loadConfig, loadProjectConfig } = require('../lib/config');
const { buildTargets, buildProjectTargets, buildProjectTargetsWithLLM, DEFAULT_BUILD_TARGETS } = require('../lib/build');
const { detectMode } = require('../lib/paths');
const { resolveApiKey } = require('../lib/credentials');

function parseBuildArgs(args) {
  if (!args || args.length === 0) {
    return { mode: 'default' };
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') {
      return { mode: 'all' };
    }
    if (args[i] === '--targets' && i + 1 < args.length) {
      const targets = args[i + 1].split(',').map((t) => t.trim()).filter(Boolean);
      return { mode: 'targets', targets };
    }
  }

  return { mode: 'default' };
}

function filterTargets(enabledTargets, buildArgs) {
  if (buildArgs.mode === 'all') {
    return enabledTargets;
  }

  const requested = buildArgs.mode === 'targets'
    ? buildArgs.targets
    : DEFAULT_BUILD_TARGETS;

  const filtered = requested.filter((t) => enabledTargets.includes(t));
  const skipped = requested.filter((t) => !enabledTargets.includes(t));

  for (const t of skipped) {
    console.log(`[ai-rules] WARN: target "${t}" is not in enabled targets, skipping`);
  }

  return filtered;
}

async function buildCommand(args) {
  const mode = detectMode();

  if (mode.type === 'project') {
    await buildProjectMode(mode.root, args);
  } else {
    await buildGlobalMode(args);
  }
}

async function buildGlobalMode(args) {
  const config = await loadConfig();
  const { atoms, parseErrors } = await loadAtoms();
  if (parseErrors.length > 0) {
    throw new Error(`atoms の読み込みに失敗しました: ${parseErrors.join('; ')}`);
  }

  const validation = validateAtoms(atoms);
  if (validation.errors.length > 0) {
    throw new Error(`atoms の検証エラー: ${validation.errors.join('; ')}`);
  }

  const buildArgs = parseBuildArgs(args);
  const enabledTargets = filterTargets(config.targets.enabled, buildArgs);

  const result = await buildTargets({
    atomsWithFile: atoms,
    enabledTargets,
  });

  console.log('[ai-rules] build completed (global)');
  console.log(`- atoms: ${result.atomsCount}`);
  console.log(`- targets: ${enabledTargets.join(', ')}`);
  for (const out of result.outputs) {
    console.log(`- output: ${out}`);
  }

  for (const warning of validation.warnings) {
    console.log(`- WARN: ${warning}`);
  }
}

async function buildProjectMode(projectRoot, args) {
  const projectConfig = await loadProjectConfig(projectRoot);
  if (!projectConfig) {
    throw new Error('.ai-rules/config.yaml が見つかりません。ai-rules init を実行してください。');
  }

  const buildArgs = parseBuildArgs(args);
  const enabledTargets = filterTargets(projectConfig.targets.enabled, buildArgs);

  const apiKey = resolveApiKey();
  const buildFn = apiKey ? buildProjectTargetsWithLLM : buildProjectTargets;

  if (apiKey) {
    console.log('[ai-rules] LLM でターゲット別に最適化中...');
  }

  const result = await buildFn({
    projectRoot,
    source: projectConfig.source,
    enabledTargets,
  });

  console.log('[ai-rules] build completed (project)');
  console.log(`- source: ${projectConfig.source}`);
  console.log(`- targets: ${enabledTargets.join(', ')}`);
  for (const out of result.outputs) {
    console.log(`- output: ${out}`);
  }
}

module.exports = {
  buildCommand,
  parseBuildArgs,
  filterTargets,
};
