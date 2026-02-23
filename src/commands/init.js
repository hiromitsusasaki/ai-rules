const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { resolveApiKey } = require('../lib/credentials');
const { transformInit } = require('../lib/transform');

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

function isHomeDir(dir) {
  return path.resolve(dir) === path.resolve(os.homedir());
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function defaultSourceCandidates(projectRoot) {
  if (isHomeDir(projectRoot)) {
    return [
      path.join(os.homedir(), '.claude', 'CLAUDE.md'),
      path.join(os.homedir(), 'AGENTS.md'),
    ];
  }
  return [path.join(projectRoot, 'CLAUDE.md')];
}

async function resolveSourcePath(projectRoot, args) {
  const sourceIdx = args.indexOf('--source');
  if (sourceIdx !== -1 && args[sourceIdx + 1]) {
    const explicit = path.resolve(projectRoot, args[sourceIdx + 1]);
    if (await fileExists(explicit)) {
      return explicit;
    }
    throw new Error(`ソースファイルが見つかりません: ${explicit}`);
  }

  const candidates = defaultSourceCandidates(projectRoot);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function openEditor(filePath) {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  console.log(`[ai-rules] ソースファイルが見つかりません。エディタで作成します: ${filePath}`);
  execFileSync(editor, [filePath], { stdio: 'inherit' });
}

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

  let sourcePath = await resolveSourcePath(projectRoot, args);

  if (!sourcePath) {
    const candidates = defaultSourceCandidates(projectRoot);
    sourcePath = candidates[0];
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, '', 'utf8');
    openEditor(sourcePath);
  }

  let sourceContent = '';
  try {
    sourceContent = await fs.readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(`ソースファイルが見つかりません: ${sourcePath}`);
  }

  if (!sourceContent.trim()) {
    throw new Error('ソースファイルが空です。内容を記述してから再度実行してください。');
  }

  await fs.mkdir(aiRulesDir, { recursive: true });

  let projectContent = sourceContent;
  const apiKey = resolveApiKey();
  if (apiKey) {
    console.log('[ai-rules] LLM で汎用ルール文書に変換中...');
    projectContent = await transformInit(sourceContent);
  } else {
    console.log('[ai-rules] API キー未設定のため、ソースをそのままコピーします。');
  }

  await fs.writeFile(path.join(aiRulesDir, 'project.md'), projectContent, 'utf8');
  await fs.writeFile(path.join(aiRulesDir, 'config.yaml'), DEFAULT_PROJECT_CONFIG, 'utf8');

  await appendToGitignore(projectRoot, '.ai-rules/dist/');
  await appendToGitignore(projectRoot, '.ai-rules/backups/');

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
