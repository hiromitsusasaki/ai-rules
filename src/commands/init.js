const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_PROJECT_CONFIG = `mode: project
source: project.md
targets:
  enabled:
    - claude-code
    - codex
    - copilot
    - gemini
    - cursor
install:
  mode: copy
  on_conflict: backup
  destinations:
    claude-code: "./CLAUDE.md"
    codex: "./AGENTS.md"
    copilot: ".github/copilot-instructions.md"
    gemini: "./GEMINI.md"
    cursor: ".cursor/rules/ai-rules.mdc"
`;

async function initCommand(args) {
  const projectRoot = process.cwd();
  const aiRulesDir = path.join(projectRoot, '.ai-rules');

  try {
    await fs.stat(aiRulesDir);
    throw new Error('.ai-rules/ は既に存在します。再初期化するには手動で削除してください。');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  let sourcePath = path.join(projectRoot, 'CLAUDE.md');
  const sourceIdx = args.indexOf('--source');
  if (sourceIdx !== -1 && args[sourceIdx + 1]) {
    sourcePath = path.resolve(projectRoot, args[sourceIdx + 1]);
  }

  let sourceContent = '';
  try {
    sourceContent = await fs.readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(`ソースファイルが見つかりません: ${sourcePath}`);
  }

  await fs.mkdir(aiRulesDir, { recursive: true });

  await fs.writeFile(path.join(aiRulesDir, 'project.md'), sourceContent, 'utf8');
  await fs.writeFile(path.join(aiRulesDir, 'config.yaml'), DEFAULT_PROJECT_CONFIG, 'utf8');

  await appendToGitignore(projectRoot, '.ai-rules/dist/');

  console.log('[ai-rules] init completed');
  console.log(`- source: ${sourcePath}`);
  console.log(`- created: .ai-rules/project.md`);
  console.log(`- created: .ai-rules/config.yaml`);
  console.log('');
  console.log('次のステップ:');
  console.log('  1. .ai-rules/project.md を編集してルールを整理');
  console.log('  2. ai-rules build でターゲットファイルを生成');
  console.log('  3. ai-rules install でプロジェクトに配布');
}

async function appendToGitignore(projectRoot, entry) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf8');
    if (content.includes(entry)) {
      return;
    }
    const separator = content.endsWith('\n') ? '' : '\n';
    await fs.writeFile(gitignorePath, `${content}${separator}${entry}\n`, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}

module.exports = {
  initCommand,
};
