const fs = require('node:fs/promises');
const path = require('node:path');
const { pathInProject } = require('./paths');

const CATEGORY_ENUM = new Set(['style', 'format', 'thinking', 'research']);
const PRIORITY_ENUM = new Set(['must', 'should', 'may']);
const STATUS_ENUM = new Set(['stable', 'experimental', 'deprecated']);
const MAX_TEXT_LENGTH = 280;

function parseScalar(raw) {
  const value = (raw ?? '').trim();
  if (!value) {
    return '';
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function parseTopLevelYamlObject(content, filePath) {
  const obj = {};
  const lines = content.replace(/\r/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (line.startsWith(' ') || line.startsWith('\t') || trimmed.startsWith('- ')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!match) {
      throw new Error(`${path.basename(filePath)}:${i + 1}: YAML構文を解釈できません`);
    }

    const key = match[1];
    const rawValue = match[2] ?? '';
    obj[key] = parseScalar(rawValue);
  }

  return obj;
}

async function loadAtoms() {
  const atomsDir = pathInProject('atoms');
  await fs.mkdir(atomsDir, { recursive: true });

  const files = await fs.readdir(atomsDir);
  const atomFiles = files
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort();

  const atoms = [];
  const parseErrors = [];

  for (const name of atomFiles) {
    const fullPath = path.join(atomsDir, name);
    const raw = await fs.readFile(fullPath, 'utf8');
    try {
      const atom = parseTopLevelYamlObject(raw, fullPath);
      atoms.push({ file: `atoms/${name}`, atom });
    } catch (error) {
      parseErrors.push(error.message);
    }
  }

  return {
    atoms,
    parseErrors,
  };
}

function validateAtoms(atomsWithFile) {
  const errors = [];
  const warnings = [];
  const idToFile = new Map();

  for (const entry of atomsWithFile) {
    const { file, atom } = entry;
    const atomId = atom.id || '(missing-id)';

    for (const key of ['id', 'category', 'priority', 'text']) {
      if (!atom[key]) {
        errors.push(`${file}: 必須項目 ${key} がありません`);
      }
    }

    if (atom.category && !CATEGORY_ENUM.has(atom.category)) {
      errors.push(`${file}: category が不正です (${atom.category})`);
    }

    if (atom.priority && !PRIORITY_ENUM.has(atom.priority)) {
      errors.push(`${file}: priority が不正です (${atom.priority})`);
    }

    if (atom.status && !STATUS_ENUM.has(atom.status)) {
      errors.push(`${file}: status が不正です (${atom.status})`);
    }

    if (atom.text && atom.text.length > MAX_TEXT_LENGTH) {
      warnings.push(`${file}: text が長すぎます (${atom.text.length} > ${MAX_TEXT_LENGTH})`);
    }

    if (atom.status === 'experimental' && !atom.review_after) {
      warnings.push(`${file}: status=experimental ですが review_after が未設定です`);
    }

    if (atom.status === 'experimental' && atom.review_after) {
      const reviewAt = new Date(atom.review_after);
      if (!Number.isNaN(reviewAt.getTime()) && reviewAt.getTime() < Date.now()) {
        warnings.push(`${file}: review_after が期限超過です (${atom.review_after})`);
      }
    }

    if (atom.id) {
      const existing = idToFile.get(atom.id);
      if (existing) {
        errors.push(`${file}: id が重複しています (${atom.id}, first: ${existing})`);
      } else {
        idToFile.set(atom.id, file);
      }
    }

    if (!atom.id || !atom.category || !atom.priority || !atom.text) {
      warnings.push(`${file}: atom=${atomId} は不完全です`);
    }
  }

  return {
    errors,
    warnings,
    stats: {
      count: atomsWithFile.length,
    },
  };
}

function listOverdueExperimentalAtoms(atomsWithFile, now = new Date()) {
  const overdue = [];
  const nowTime = now.getTime();

  for (const entry of atomsWithFile) {
    const { file, atom } = entry;
    if (atom.status !== 'experimental' || !atom.review_after) {
      continue;
    }
    const reviewAt = new Date(atom.review_after);
    if (Number.isNaN(reviewAt.getTime())) {
      continue;
    }
    if (reviewAt.getTime() < nowTime) {
      overdue.push({
        file,
        id: atom.id || '',
        review_after: atom.review_after,
      });
    }
  }

  return overdue.sort((a, b) => String(a.review_after).localeCompare(String(b.review_after)));
}

module.exports = {
  loadAtoms,
  validateAtoms,
  listOverdueExperimentalAtoms,
  MAX_TEXT_LENGTH,
};
