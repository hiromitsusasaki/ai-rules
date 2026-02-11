const fs = require('node:fs/promises');
const path = require('node:path');
const { pathInProject } = require('./paths');

const CATEGORY_ORDER = ['style', 'format', 'thinking', 'research'];
const PRIORITY_ORDER = ['must', 'should', 'may'];

const MARKDOWN_TARGETS = ['claude-code', 'codex', 'copilot', 'gemini', 'opencode'];

const TARGET_DIST_MAP = {
  chat: 'dist/chat/custom_instructions.txt',
  'claude-code': 'dist/claude-code/CLAUDE.md',
  codex: 'dist/codex/AGENTS.md',
  copilot: 'dist/copilot/copilot-instructions.md',
  gemini: 'dist/gemini/GEMINI.md',
  opencode: 'dist/opencode/AGENTS.md',
  cursor: 'dist/cursor/ai-rules.mdc',
  openclaw: 'dist/openclaw/skills/personal-constitution/SKILL.md',
};

function sortAtoms(atoms) {
  return [...atoms].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) {
      return pa - pb;
    }
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) {
      return ca - cb;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

function filterBuildAtoms(atomsWithFile) {
  return atomsWithFile
    .map((x) => x.atom)
    .filter((atom) => atom.id && atom.category && atom.priority && atom.text)
    .filter((atom) => atom.status !== 'deprecated');
}

function renderChatInstructions(atoms) {
  const musts = atoms.filter((a) => a.priority === 'must');
  const shoulds = atoms.filter((a) => a.priority === 'should');

  const lines = [];
  lines.push('個人用AIルール（簡易版）');
  lines.push('');
  lines.push('最優先（must）');
  if (musts.length === 0) {
    lines.push('- (none)');
  } else {
    for (const atom of musts) {
      lines.push(`- ${atom.text}`);
    }
  }
  lines.push('');
  lines.push('推奨（should）');
  if (shoulds.length === 0) {
    lines.push('- (none)');
  } else {
    for (const atom of shoulds) {
      lines.push(`- ${atom.text}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdownRules(atoms) {
  const grouped = new Map(CATEGORY_ORDER.map((cat) => [cat, []]));
  for (const atom of atoms) {
    if (!grouped.has(atom.category)) {
      grouped.set(atom.category, []);
    }
    grouped.get(atom.category).push(atom);
  }

  const lines = [];
  lines.push('# AI Rules');
  lines.push('');
  lines.push('このドキュメントは `atoms/*.yaml` から生成されています。');
  lines.push('');

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category) || [];
    lines.push(`## ${category}`);
    lines.push('');
    if (items.length === 0) {
      lines.push('- (none)');
      lines.push('');
      continue;
    }
    for (const atom of items) {
      lines.push(`- [${atom.priority}] ${atom.text}`);
      lines.push(`  - id: ${atom.id}`);
      if (atom.rationale) {
        lines.push(`  - rationale: ${atom.rationale}`);
      }
      if (atom.status) {
        lines.push(`  - status: ${atom.status}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderCursorMDC(atoms) {
  const grouped = new Map(CATEGORY_ORDER.map((cat) => [cat, []]));
  for (const atom of atoms) {
    if (!grouped.has(atom.category)) {
      grouped.set(atom.category, []);
    }
    grouped.get(atom.category).push(atom);
  }

  const lines = [];
  lines.push('---');
  lines.push('description: Personal AI rules generated from atoms');
  lines.push('alwaysApply: true');
  lines.push('---');
  lines.push('');
  lines.push('# AI Rules');
  lines.push('');

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category) || [];
    lines.push(`## ${category}`);
    lines.push('');
    if (items.length === 0) {
      lines.push('- (none)');
      lines.push('');
      continue;
    }
    for (const atom of items) {
      lines.push(`- [${atom.priority}] ${atom.text}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderOpenClawSkill(atoms) {
  const grouped = new Map(CATEGORY_ORDER.map((cat) => [cat, []]));
  for (const atom of atoms) {
    if (!grouped.has(atom.category)) {
      grouped.set(atom.category, []);
    }
    grouped.get(atom.category).push(atom);
  }

  const lines = [];
  lines.push('---');
  lines.push('name: personal-constitution');
  lines.push('description: Personal global AI operation rules generated from atoms');
  lines.push('---');
  lines.push('');
  lines.push('# Personal Constitution');
  lines.push('');
  for (const category of CATEGORY_ORDER) {
    lines.push(`## ${category}`);
    lines.push('');
    const items = grouped.get(category) || [];
    if (items.length === 0) {
      lines.push('- (none)');
      lines.push('');
      continue;
    }
    for (const atom of items) {
      lines.push(`- [${atom.priority}] ${atom.text}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function writeTarget(relativePath, content) {
  const abs = pathInProject(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

function renderForTarget(target, atoms) {
  if (target === 'chat') {
    return renderChatInstructions(atoms);
  }
  if (MARKDOWN_TARGETS.includes(target)) {
    return renderMarkdownRules(atoms);
  }
  if (target === 'cursor') {
    return renderCursorMDC(atoms);
  }
  if (target === 'openclaw') {
    return renderOpenClawSkill(atoms);
  }
  return null;
}

async function buildTargets({ atomsWithFile, enabledTargets }) {
  const atoms = sortAtoms(filterBuildAtoms(atomsWithFile));
  const outputs = [];

  for (const target of enabledTargets) {
    const distRelPath = TARGET_DIST_MAP[target];
    if (!distRelPath) {
      continue;
    }
    const content = renderForTarget(target, atoms);
    if (content === null) {
      continue;
    }
    const abs = await writeTarget(distRelPath, content);
    outputs.push(abs);
  }

  return {
    outputs,
    atomsCount: atoms.length,
  };
}

function renderProjectCursorMDC(content) {
  const lines = [];
  lines.push('---');
  lines.push('description: Project AI rules');
  lines.push('alwaysApply: true');
  lines.push('---');
  lines.push('');
  lines.push(content.trimEnd());
  lines.push('');
  return lines.join('\n');
}

function renderProjectTarget(target, content) {
  if (target === 'cursor') {
    return renderProjectCursorMDC(content);
  }
  return content;
}

async function buildProjectTargets({ projectRoot, source, enabledTargets }) {
  const sourcePath = path.join(projectRoot, '.ai-rules', source);
  const content = await fs.readFile(sourcePath, 'utf8');
  const distBase = path.join(projectRoot, '.ai-rules', 'dist');
  const outputs = [];

  for (const target of enabledTargets) {
    const distRelPath = TARGET_DIST_MAP[target];
    if (!distRelPath) {
      continue;
    }
    const rendered = renderProjectTarget(target, content);
    const abs = path.join(distBase, distRelPath.replace(/^dist\//, ''));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, rendered, 'utf8');
    outputs.push(abs);
  }

  return { outputs };
}

module.exports = {
  buildTargets,
  buildProjectTargets,
  TARGET_DIST_MAP,
};
