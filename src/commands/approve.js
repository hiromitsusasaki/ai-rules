const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

function simpleDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const output = [];

  let oi = 0;
  let ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      output.push(`  ${oldLines[oi]}`);
      oi += 1;
      ni += 1;
    } else if (oi < oldLines.length && (ni >= newLines.length || oldLines[oi] !== newLines[ni])) {
      output.push(`- ${oldLines[oi]}`);
      oi += 1;
    } else {
      output.push(`+ ${newLines[ni]}`);
      ni += 1;
    }
  }

  return output.join('\n');
}

async function findLastProposal(proposalsDir) {
  try {
    const entries = await fs.readdir(proposalsDir);
    const sorted = entries
      .filter((e) => !e.startsWith('.'))
      .sort()
      .reverse();
    if (sorted.length === 0) {
      return null;
    }
    return sorted[0];
  } catch {
    return null;
  }
}

async function approveCommand(args) {
  const projectRoot = process.cwd();
  const proposalsDir = path.join(projectRoot, '.ai-rules', 'proposals');
  const projectMdPath = path.join(projectRoot, '.ai-rules', 'project.md');

  let proposalId;
  if (args.includes('--last')) {
    proposalId = await findLastProposal(proposalsDir);
    if (!proposalId) {
      throw new Error('提案が見つかりません。ai-rules ingest でコンテンツを取り込んでください。');
    }
  } else if (args.length > 0 && !args[0].startsWith('-')) {
    proposalId = args[0];
  } else {
    throw new Error('使い方: ai-rules approve --last  または  ai-rules approve <proposal-id>');
  }

  const proposalPath = path.join(proposalsDir, proposalId, 'proposed-project.md');
  let proposedContent;
  try {
    proposedContent = await fs.readFile(proposalPath, 'utf8');
  } catch {
    throw new Error(`提案ファイルが見つかりません: ${proposalPath}`);
  }

  let currentContent = '';
  try {
    currentContent = await fs.readFile(projectMdPath, 'utf8');
  } catch {
    // project.md doesn't exist yet
  }

  console.log('[ai-rules] 提案の差分:');
  console.log('---');
  console.log(simpleDiff(currentContent, proposedContent));
  console.log('---');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await prompt(rl, 'この提案を承認して project.md を更新しますか？ (y/n): ');
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('[ai-rules] キャンセルしました。');
      return;
    }
  } finally {
    rl.close();
  }

  await fs.writeFile(projectMdPath, proposedContent, 'utf8');
  console.log(`[ai-rules] project.md を更新しました (proposal: ${proposalId})`);
}

module.exports = {
  approveCommand,
};
