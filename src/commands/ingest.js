const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { toFrontmatter } = require('../lib/frontmatter');
const { pathInProject, detectMode } = require('../lib/paths');
const { extractHtmlMeta, normalizeWhitespace } = require('../lib/text');
const { resolveApiKey } = require('../lib/credentials');
const { transformIngestMerge } = require('../lib/transform');

function parseIngestArgs(args) {
  const parsed = {
    url: null,
    text: null,
    filePath: null,
    stdin: false,
  };

  if (args.length === 1 && !args[0].startsWith('-')) {
    parsed.url = args[0];
    return parsed;
  }

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--stdin') {
      parsed.stdin = true;
      continue;
    }
    if (token === '--text') {
      parsed.text = args[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--file') {
      parsed.filePath = args[i + 1] ?? '';
      i += 1;
      continue;
    }
  }

  return parsed;
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function isUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function hashOf(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 8);
}

async function ingestFromUrl(url) {
  const res = await fetch(url);
  const raw = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  const fetchedAt = nowIso();

  let title = '';
  let content = '';
  let extractionNote = '';

  if (contentType.includes('text/html')) {
    const extracted = extractHtmlMeta(raw);
    title = extracted.title;
    content = extracted.text;
    if (!content) {
      extractionNote = 'HTML本文抽出に失敗したため、生HTMLを保存しました。';
      content = raw;
    }
  } else {
    content = normalizeWhitespace(raw);
  }

  return {
    source_kind: 'url',
    source: url,
    fetched_at: fetchedAt,
    title,
    content_type: contentType,
    hash: hashOf(`${url}:${raw}`),
    content,
    extraction_note: extractionNote,
  };
}

async function ingestFromText(text) {
  const normalized = normalizeWhitespace(text);
  return {
    source_kind: 'text',
    source: 'user_input',
    fetched_at: nowIso(),
    content_type: 'text/plain',
    hash: hashOf(normalized),
    content: normalized,
    extraction_note: '',
  };
}

async function ingestFromFile(filePathArg) {
  const absolute = path.resolve(filePathArg);
  const content = await fs.readFile(absolute, 'utf8');
  const normalized = normalizeWhitespace(content);
  return {
    source_kind: 'file',
    source: absolute,
    fetched_at: nowIso(),
    content_type: 'text/plain',
    hash: hashOf(`${absolute}:${normalized}`),
    content: normalized,
    extraction_note: '',
  };
}

function buildInboxMarkdown(metadata) {
  const frontmatter = toFrontmatter({
    source_kind: metadata.source_kind,
    source: metadata.source,
    fetched_at: metadata.fetched_at,
    title: metadata.title ?? '',
    content_type: metadata.content_type ?? '',
    hash: metadata.hash,
  });

  const noteBlock = metadata.extraction_note ? `\n# Notes\n\n${metadata.extraction_note}\n` : '';

  return `${frontmatter}\n\n# Content\n\n${metadata.content}\n${noteBlock}`;
}

async function ingestCommand(args) {
  const parsed = parseIngestArgs(args);
  const inputsCount = [parsed.url ? 1 : 0, parsed.text !== null ? 1 : 0, parsed.filePath ? 1 : 0, parsed.stdin ? 1 : 0].reduce((a, b) => a + b, 0);
  if (inputsCount !== 1) {
    throw new Error('ingest は URL / --stdin / --text / --file のいずれか1つだけ指定してください。');
  }

  let metadata;

  if (parsed.url) {
    if (!isUrl(parsed.url)) {
      throw new Error(`無効なURLです: ${parsed.url}`);
    }
    metadata = await ingestFromUrl(parsed.url);
  } else if (parsed.stdin) {
    const stdinText = await readStdin();
    metadata = await ingestFromText(stdinText);
    metadata.source_kind = 'stdin';
    metadata.source = 'stdin';
  } else if (parsed.text !== null) {
    metadata = await ingestFromText(parsed.text);
  } else if (parsed.filePath) {
    metadata = await ingestFromFile(parsed.filePath);
  }

  const inboxDir = pathInProject('inbox');
  await fs.mkdir(inboxDir, { recursive: true });

  const fileName = `${timestampForFile()}_${metadata.source_kind}_${metadata.hash}.md`;
  const outPath = path.join(inboxDir, fileName);
  const markdown = buildInboxMarkdown(metadata);

  await fs.writeFile(outPath, markdown, 'utf8');

  console.log(`[ai-rules] saved: ${outPath}`);

  const mode = detectMode();
  const apiKey = resolveApiKey();

  if (mode.type === 'project' && apiKey) {
    const projectMdPath = path.join(mode.root, '.ai-rules', 'project.md');
    let projectContent;
    try {
      projectContent = await fs.readFile(projectMdPath, 'utf8');
    } catch {
      projectContent = null;
    }

    if (projectContent !== null) {
      console.log('[ai-rules] LLM でマージ提案を生成中...');
      try {
        const proposed = await transformIngestMerge(projectContent, metadata.content, {
          source: metadata.source,
          source_kind: metadata.source_kind,
        });

        const proposalId = timestampForFile();
        const proposalDir = path.join(mode.root, '.ai-rules', 'proposals', proposalId);
        await fs.mkdir(proposalDir, { recursive: true });
        await fs.writeFile(path.join(proposalDir, 'proposed-project.md'), proposed, 'utf8');

        console.log(`[ai-rules] マージ提案を保存しました: .ai-rules/proposals/${proposalId}/`);
        console.log('[ai-rules] 承認するには: ai-rules approve --last');
      } catch (err) {
        console.error(`[ai-rules] WARN: マージ提案の生成に失敗しました: ${err.message}`);
      }
    }
  }
}

module.exports = {
  ingestCommand,
};
