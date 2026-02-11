const { loadConfig, loadProjectConfig } = require('../lib/config');
const { resolveInstallItems, resolveProjectInstallItems, installOne } = require('../lib/install');
const { detectMode } = require('../lib/paths');

async function installCommand() {
  const mode = detectMode();

  if (mode.type === 'project') {
    await installProjectMode(mode.root);
  } else {
    await installGlobalMode();
  }
}

async function installGlobalMode() {
  const config = await loadConfig();
  const items = resolveInstallItems(config);
  const mode = config.install.mode;
  const onConflict = config.install.on_conflict;

  if (items.length === 0) {
    console.log('[ai-rules] install: 対象がありません');
    return;
  }

  console.log('[ai-rules] install start (global)');
  console.log(`- mode: ${mode}`);
  console.log(`- on_conflict: ${onConflict}`);

  await runInstall(items, mode, onConflict);
}

async function installProjectMode(projectRoot) {
  const projectConfig = await loadProjectConfig(projectRoot);
  if (!projectConfig) {
    throw new Error('.ai-rules/config.yaml が見つかりません。ai-rules init を実行してください。');
  }

  const items = resolveProjectInstallItems({
    projectRoot,
    enabledTargets: projectConfig.targets.enabled,
    destinations: projectConfig.install.destinations,
  });
  const mode = projectConfig.install.mode;
  const onConflict = projectConfig.install.on_conflict;

  if (items.length === 0) {
    console.log('[ai-rules] install: 対象がありません');
    return;
  }

  console.log('[ai-rules] install start (project)');
  console.log(`- mode: ${mode}`);
  console.log(`- on_conflict: ${onConflict}`);

  await runInstall(items, mode, onConflict);
}

async function runInstall(items, mode, onConflict) {
  let installed = 0;
  let skipped = 0;
  const backups = [];

  for (const item of items) {
    const result = await installOne({
      source: item.source,
      destination: item.destination,
      mode,
      onConflict,
    });

    if (result.status === 'installed') {
      installed += 1;
      console.log(`- installed: ${item.target} -> ${result.destination}`);
      if (result.backupPath) {
        backups.push(result.backupPath);
      }
      continue;
    }

    skipped += 1;
    console.log(`- skipped: ${item.target} (${result.reason}) -> ${item.destination}`);
  }

  console.log(`[ai-rules] install done: installed=${installed}, skipped=${skipped}`);
  for (const backupPath of backups) {
    console.log(`- backup: ${backupPath}`);
  }
}

module.exports = {
  installCommand,
};
