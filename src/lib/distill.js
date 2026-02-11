const crypto = require('node:crypto');

function normalizeText(input) {
  return String(input ?? '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractContentSection(markdown) {
  const match = markdown.match(/(?:^|\n)# Content\s*\n([\s\S]*?)(?:\n# [^\n]+|\s*$)/);
  if (!match) {
    return '';
  }
  return normalizeText(match[1]);
}

function splitSentences(content) {
  const base = normalizeText(content);
  if (!base) {
    return [];
  }
  return base
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

function isNormative(sentence) {
  return /(する|しない|べき|禁止|優先|確認|明記|検証|質問|記録|保持|避ける|must|should|never|always|do not|avoid)/i.test(sentence);
}

function inferCategory(sentence) {
  if (/(一次情報|source|出典|引用|根拠|検証|参照日|発行日|日付)/i.test(sentence)) {
    return 'research';
  }
  if (/(形式|フォーマット|見出し|箇条書き|構造|yaml|json|markdown)/i.test(sentence)) {
    return 'format';
  }
  if (/(簡潔|明確|冗長|文体|トーン|丁寧|表現)/i.test(sentence)) {
    return 'style';
  }
  return 'thinking';
}

function inferPriority(sentence) {
  if (/(必ず|禁止|never|must|do not)/i.test(sentence)) {
    return 'must';
  }
  if (/(任意|may|できれば)/i.test(sentence)) {
    return 'may';
  }
  return 'should';
}

function generalizeVendors(sentence) {
  return sentence.replace(/\b(ChatGPT|Claude|Codex|Notion|Slack|Gemini|Cursor)\b/g, '外部ツール');
}

function sentenceToRuleText(sentence) {
  const compact = generalizeVendors(normalizeText(sentence)).replace(/\s+/g, ' ');
  if (compact.length <= 120) {
    return compact;
  }
  return `${compact.slice(0, 117)}...`;
}

function snakeCaseFromText(sentence) {
  const ascii = sentence
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join('_');
  return ascii;
}

function fallbackIdBase(category, sentence, index) {
  if (category === 'research' && /(一次情報|source|出典|引用|根拠)/i.test(sentence)) {
    return 'primary_sources_first';
  }
  if (category === 'thinking' && /(前提|仮定|不足|不明|質問)/i.test(sentence)) {
    return 'state_assumptions_before_action';
  }
  if (category === 'style' && /(簡潔|明確|冗長)/i.test(sentence)) {
    return 'be_concise_and_precise';
  }
  if (category === 'format' && /(見出し|箇条書き|構造|yaml|json|markdown)/i.test(sentence)) {
    return 'keep_output_structure_consistent';
  }
  return `rule_${index + 1}`;
}

function buildIdHint(category, sentence, index) {
  const snake = snakeCaseFromText(sentence);
  const base = snake || fallbackIdBase(category, sentence, index);
  return `${category}.${base}`;
}

function dedupeByText(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = c.text;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(c);
  }
  return out;
}

function distillCandidates({ inboxPath, frontmatter, content }) {
  const sentences = splitSentences(content);
  const candidates = [];
  const dropped = [];
  let mustCount = 0;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    if (!isNormative(sentence)) {
      if (dropped.length < 10) {
        dropped.push({
          reason: '規範文ではないため除外',
          quote: sentence.slice(0, 140),
        });
      }
      continue;
    }

    const category = inferCategory(sentence);
    let priority = inferPriority(sentence);
    if (priority === 'must') {
      if (mustCount >= 5) {
        priority = 'should';
      } else {
        mustCount += 1;
      }
    }

    const text = sentenceToRuleText(sentence);
    const idHint = buildIdHint(category, sentence, candidates.length);
    const digest = crypto.createHash('sha1').update(idHint + text).digest('hex').slice(0, 6);

    candidates.push({
      id_hint: `${idHint}_${digest}`,
      category,
      priority,
      text,
      rationale: '入力文書で繰り返し現れる運用意図を規範として再利用するため。',
      examples: { good: [], bad: [] },
      sources: [
        {
          quote: sentence.slice(0, 180),
          location_hint: '# Content',
        },
      ],
      status: 'experimental',
      review_after_days: 30,
    });

    if (candidates.length >= 15) {
      break;
    }
  }

  const unique = dedupeByText(candidates);
  return {
    source: {
      inbox_path: inboxPath,
      source_kind: frontmatter.source_kind || '',
      source: frontmatter.source || '',
    },
    candidates: unique,
    meta: {
      dropped,
    },
  };
}

function yamlScalar(value) {
  if (value === null || value === undefined) {
    return '""';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function toYaml(value, indent = 0) {
  const sp = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${sp}[]`;
    }
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const inner = toYaml(item, indent + 2);
          const lines = inner.split('\n');
          const first = lines[0].trimStart();
          const rest = lines.slice(1).join('\n');
          if (!rest) {
            return `${sp}- ${first}`;
          }
          return `${sp}- ${first}\n${rest}`;
        }
        return `${sp}- ${yamlScalar(item)}`;
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return `${sp}{}`;
    }
    return entries
      .map(([key, v]) => {
        if (v && typeof v === 'object') {
          return `${sp}${key}:\n${toYaml(v, indent + 2)}`;
        }
        return `${sp}${key}: ${yamlScalar(v)}`;
      })
      .join('\n');
  }
  return `${sp}${yamlScalar(value)}`;
}

module.exports = {
  extractContentSection,
  distillCandidates,
  toYaml,
};
