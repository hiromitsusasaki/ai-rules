const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathInProject } = require('../lib/paths');
const { parseFrontmatter } = require('../lib/frontmatter');
const { extractContentSection, distillCandidates, toYaml } = require('../lib/distill');
const { loadAtoms } = require('../lib/atoms');
const { loadConfig } = require('../lib/config');
const { reconcileCandidates } = require('../lib/reconcile');
const { generatePatchFromPlan } = require('../lib/patch');

function timestampCompact(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function resolveInboxPath(args) {
  const inboxDir = pathInProject('inbox');
  await fs.mkdir(inboxDir, { recursive: true });

  if (args[0] === '--last') {
    const files = (await fs.readdir(inboxDir))
      .filter((name) => name.endsWith('.md'))
      .sort();
    if (files.length === 0) {
      throw new Error('inbox が空です。先に ingest を実行してください。');
    }
    return path.join(inboxDir, files[files.length - 1]);
  }

  if (args.length !== 1) {
    throw new Error('propose は <inbox_path> か --last のどちらかを指定してください。');
  }

  const input = args[0];
  if (path.isAbsolute(input)) {
    return input;
  }
  return pathInProject(input);
}

function buildSummary({ proposalId, inboxPath, result, plan, patchResult }) {
  const lines = [];
  lines.push('# Proposal Summary');
  lines.push('');
  lines.push(`- proposal_id: ${proposalId}`);
  lines.push(`- inbox_path: ${inboxPath}`);
  lines.push(`- candidates: ${result.candidates.length}`);
  lines.push(`- dropped: ${result.meta.dropped.length}`);
  lines.push(`- reconcile_actions: ${plan.plan.actions.length}`);
  lines.push(`- must_additions: ${plan.meta.must_additions_count}/${plan.meta.must_additions_limit}`);
  lines.push(`- patch_changed_files: ${patchResult.changedFiles}`);
  lines.push(`- patch_file: ${patchResult.patchPath}`);
  lines.push('');
  lines.push('## Candidates');
  lines.push('');
  if (result.candidates.length === 0) {
    lines.push('- (none)');
  } else {
    for (const c of result.candidates) {
      lines.push(`- ${c.id_hint} | ${c.category} | ${c.priority}`);
      lines.push(`  - text: ${c.text}`);
      lines.push(`  - quote: ${c.sources[0]?.quote ?? ''}`);
    }
  }
  lines.push('');
  lines.push('## Reconcile Plan');
  lines.push('');
  if (plan.plan.actions.length === 0) {
    lines.push('- (none)');
  } else {
    for (const action of plan.plan.actions) {
      if (action.type === 'update_existing') {
        lines.push(`- update_existing: ${action.target_id}`);
        lines.push(`  - reason: ${action.justification}`);
      } else if (action.type === 'create_new') {
        lines.push(`- create_new: ${action.new_atom.id}`);
        lines.push(`  - priority: ${action.new_atom.priority}`);
        lines.push(`  - reason: ${action.justification}`);
      } else if (action.type === 'conflict') {
        lines.push(`- conflict: ${action.candidate_id_hint}`);
        lines.push(`  - with: ${(action.conflicts_with_ids || []).join(', ')}`);
        lines.push(`  - note: ${action.note}`);
      } else if (action.type === 'drop') {
        lines.push(`- drop: ${action.candidate_id_hint}`);
        lines.push(`  - reason: ${action.reason}`);
      }
    }
  }
  lines.push('');
  lines.push('## Dropped');
  lines.push('');
  if (result.meta.dropped.length === 0) {
    lines.push('- (none)');
  } else {
    for (const d of result.meta.dropped) {
      lines.push(`- ${d.reason}: ${d.quote}`);
    }
  }
  if ((patchResult.warnings || []).length > 0) {
    lines.push('');
    lines.push('## Patch Warnings');
    lines.push('');
    for (const warning of patchResult.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function proposeCommand(args) {
  const resolvedInboxPath = await resolveInboxPath(args);
  const raw = await fs.readFile(resolvedInboxPath, 'utf8');
  const frontmatter = parseFrontmatter(raw) ?? {};
  const content = extractContentSection(raw);

  if (!content) {
    throw new Error(`# Content が空です: ${resolvedInboxPath}`);
  }

  const relInboxPath = path.relative(pathInProject(), resolvedInboxPath).replace(/\\/g, '/');
  const result = distillCandidates({
    inboxPath: relInboxPath,
    frontmatter,
    content,
  });
  const config = await loadConfig();
  const { atoms, parseErrors } = await loadAtoms();
  if (parseErrors.length > 0) {
    throw new Error(`atoms の読み込みに失敗しました: ${parseErrors.join('; ')}`);
  }

  const existingAtoms = atoms
    .map((entry) => entry.atom)
    .filter((atom) => atom.id && atom.category && atom.priority && atom.text);

  const candidatesWithSourcePath = result.candidates.map((candidate) => ({
    ...candidate,
    sources: (candidate.sources || []).map((src) => ({
      ...src,
      path: relInboxPath,
    })),
  }));

  const plan = reconcileCandidates({
    existingAtoms,
    candidates: candidatesWithSourcePath,
    maxMustAdditions: config.propose.max_must_additions,
  });

  const proposalIdSeed = `${timestampCompact()}_${path.basename(resolvedInboxPath)}_${crypto.randomBytes(4).toString('hex')}`;
  const proposalIdHash = crypto.createHash('sha1').update(proposalIdSeed).digest('hex').slice(0, 8);
  const proposalId = `${timestampCompact()}_${proposalIdHash}`;
  const proposalDir = pathInProject('proposals', proposalId);
  await fs.mkdir(proposalDir, { recursive: true });

  const candidatesPath = path.join(proposalDir, 'candidates.yaml');
  const planPath = path.join(proposalDir, 'plan.yaml');
  const patchPath = path.join(proposalDir, 'patch.diff');
  const summaryPath = path.join(proposalDir, 'summary.md');

  await fs.writeFile(candidatesPath, `${toYaml(result)}\n`, 'utf8');
  await fs.writeFile(planPath, `${toYaml(plan)}\n`, 'utf8');
  const patchResult = await generatePatchFromPlan({
    proposalDir,
    proposalId,
    plan,
    atomsWithFile: atoms,
    mode: config.patch.mode,
  });
  await fs.writeFile(summaryPath, buildSummary({ proposalId, inboxPath: relInboxPath, result, plan, patchResult }), 'utf8');

  console.log(`[ai-rules] proposal created: ${proposalDir}`);
  console.log(`[ai-rules] candidates: ${candidatesPath}`);
  console.log(`[ai-rules] plan: ${planPath}`);
  console.log(`[ai-rules] patch: ${patchPath}`);
  console.log(`[ai-rules] summary: ${summaryPath}`);
  for (const warning of patchResult.warnings) {
    console.log(`[ai-rules] WARN: ${warning}`);
  }
}

module.exports = {
  proposeCommand,
};
