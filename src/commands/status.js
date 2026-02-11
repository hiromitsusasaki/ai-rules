const fs = require('node:fs/promises');
const path = require('node:path');
const { pathInProject } = require('../lib/paths');
const { parseFrontmatter } = require('../lib/frontmatter');
const { loadAtoms, listOverdueExperimentalAtoms } = require('../lib/atoms');

async function listUnreviewedProposals(limit = 10) {
  const proposalsDir = pathInProject('proposals');
  await fs.mkdir(proposalsDir, { recursive: true });

  const entries = await fs.readdir(proposalsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  const unreviewed = [];
  for (const name of dirs) {
    const dir = path.join(proposalsDir, name);
    const summaryPath = path.join(dir, 'summary.md');
    const reviewedMarker = path.join(dir, '.reviewed');
    let hasSummary = false;
    let reviewed = false;

    try {
      await fs.access(summaryPath);
      hasSummary = true;
    } catch {
      hasSummary = false;
    }

    try {
      await fs.access(reviewedMarker);
      reviewed = true;
    } catch {
      reviewed = false;
    }

    if (hasSummary && !reviewed) {
      unreviewed.push(name);
    }

    if (unreviewed.length >= limit) {
      break;
    }
  }

  return unreviewed;
}

async function statusCommand() {
  const inboxDir = pathInProject('inbox');
  await fs.mkdir(inboxDir, { recursive: true });

  const files = (await fs.readdir(inboxDir)).filter((name) => name.endsWith('.md')).sort().reverse();
  const unreviewedProposals = await listUnreviewedProposals(10);
  const { atoms } = await loadAtoms();
  const overdueExperimental = listOverdueExperimentalAtoms(atoms, new Date());

  console.log('[ai-rules] status');
  console.log(`- inbox files: ${files.length}`);

  const latest = files.slice(0, 10);
  for (const fileName of latest) {
    const abs = path.join(inboxDir, fileName);
    const content = await fs.readFile(abs, 'utf8');
    const fm = parseFrontmatter(content) ?? {};
    const fetchedAt = fm.fetched_at || '-';
    const sourceKind = fm.source_kind || '-';
    const source = fm.source || '-';
    console.log(`  - ${fileName} | ${fetchedAt} | ${sourceKind} | ${source}`);
  }

  console.log(`- unreviewed proposals: ${unreviewedProposals.length}`);
  if (unreviewedProposals.length === 0) {
    console.log('  - (none)');
  } else {
    for (const proposalId of unreviewedProposals) {
      console.log(`  - ${proposalId}`);
    }
  }

  console.log(`- overdue experimental atoms: ${overdueExperimental.length}`);
  if (overdueExperimental.length === 0) {
    console.log('  - (none)');
  } else {
    for (const item of overdueExperimental.slice(0, 10)) {
      console.log(`  - ${item.id || '(no-id)'} | ${item.review_after} | ${item.file}`);
    }
  }
}

module.exports = {
  statusCommand,
};
