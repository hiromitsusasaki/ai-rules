const fs = require('node:fs/promises');
const path = require('node:path');
const { pathInProject } = require('./paths');
const { toYaml } = require('./distill');

function splitLines(input) {
  const normalized = String(input ?? '').replace(/\r/g, '');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function hunkForAdded(filePath, content) {
  const lines = splitLines(content);
  const plus = lines.map((l) => `+${l}`).join('\n');
  return [
    `--- /dev/null`,
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    plus,
    '',
  ].join('\n');
}

function hunkForModified(filePath, oldContent, newContent) {
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);
  const minus = oldLines.map((l) => `-${l}`).join('\n');
  const plus = newLines.map((l) => `+${l}`).join('\n');
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    minus,
    plus,
    '',
  ].join('\n');
}

function materializeAtomYaml(atom) {
  const out = { ...atom };
  if (out.review_after_days && !out.review_after) {
    const d = new Date();
    d.setDate(d.getDate() + Number(out.review_after_days));
    out.review_after = d.toISOString().slice(0, 10);
  }
  delete out.review_after_days;
  return `${toYaml(out)}\n`;
}

function appendUniqueString(list, value) {
  if (!value) {
    return list;
  }
  const next = Array.isArray(list) ? [...list] : [];
  if (!next.includes(value)) {
    next.push(value);
  }
  return next;
}

function applyUpdateToAtom(atom, action) {
  const next = { ...atom };
  const updates = action.updates || {};

  if (updates.rationale_append) {
    next.rationale = next.rationale ? `${next.rationale} ${updates.rationale_append}` : updates.rationale_append;
  }

  const existingGood = Array.isArray(next.examples?.good) ? next.examples.good : [];
  const existingBad = Array.isArray(next.examples?.bad) ? next.examples.bad : [];
  const appendGood = Array.isArray(updates.examples_append?.good) ? updates.examples_append.good : [];
  const appendBad = Array.isArray(updates.examples_append?.bad) ? updates.examples_append.bad : [];
  if (existingGood.length || existingBad.length || appendGood.length || appendBad.length) {
    next.examples = {
      good: [...existingGood, ...appendGood],
      bad: [...existingBad, ...appendBad],
    };
  }

  const appendedSources = Array.isArray(updates.sources_append) ? updates.sources_append : [];
  let sources = Array.isArray(next.sources) ? [...next.sources] : [];
  for (const s of appendedSources) {
    const sourceText = [s.path, s.quote].filter(Boolean).join(' | ');
    sources = appendUniqueString(sources, sourceText);
  }
  if (sources.length > 0) {
    next.sources = sources;
  }

  return next;
}

async function generatePatchFromPlan({ proposalDir, proposalId, plan, atomsWithFile, mode }) {
  const byId = new Map();
  const byFile = new Map();
  for (const entry of atomsWithFile) {
    byId.set(entry.atom.id, entry);
    byFile.set(entry.file, entry);
  }

  const changedFiles = new Map();
  const warnings = [];

  for (const action of plan.plan.actions) {
    if (action.type === 'drop' || action.type === 'conflict') {
      continue;
    }

    if (action.type === 'create_new') {
      const filePath = `atoms/${action.new_atom.id}.yaml`;
      const content = materializeAtomYaml(action.new_atom);
      changedFiles.set(filePath, {
        kind: 'add',
        oldContent: '',
        newContent: content,
      });
      continue;
    }

    if (action.type === 'update_existing') {
      const target = byId.get(action.target_id);
      if (!target) {
        warnings.push(`update_existing の target_id が見つかりません: ${action.target_id}`);
        continue;
      }
      const fullPath = pathInProject(target.file);
      const oldContent = await fs.readFile(fullPath, 'utf8');
      const nextAtom = applyUpdateToAtom(target.atom, action);
      const newContent = materializeAtomYaml(nextAtom);
      changedFiles.set(target.file, {
        kind: 'modify',
        oldContent,
        newContent,
      });
    }
  }

  const filePaths = Array.from(changedFiles.keys()).sort();
  const hunks = [];
  for (const filePath of filePaths) {
    const change = changedFiles.get(filePath);
    if (change.kind === 'add') {
      hunks.push(hunkForAdded(filePath, change.newContent));
      continue;
    }
    if (change.oldContent !== change.newContent) {
      hunks.push(hunkForModified(filePath, change.oldContent, change.newContent));
    }
  }

  const patchContent = hunks.join('\n');
  const patchPath = path.join(proposalDir, 'patch.diff');
  await fs.writeFile(patchPath, patchContent, 'utf8');

  if (mode === 'branch') {
    warnings.push(`patch.mode=branch は未適用です。patch.diff のみ生成しました（proposal_id=${proposalId}）。`);
  }

  return {
    patchPath,
    changedFiles: filePaths.length,
    warnings,
  };
}

module.exports = {
  generatePatchFromPlan,
};
