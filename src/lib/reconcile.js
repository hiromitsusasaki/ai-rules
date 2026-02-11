function normalizeText(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function charBigrams(input) {
  const text = normalizeText(input).replace(/\s/g, '');
  const out = new Set();
  if (text.length < 2) {
    if (text) {
      out.add(text);
    }
    return out;
  }
  for (let i = 0; i < text.length - 1; i += 1) {
    out.add(text.slice(i, i + 2));
  }
  return out;
}

function jaccard(a, b) {
  const setA = charBigrams(a);
  const setB = charBigrams(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const x of setA) {
    if (setB.has(x)) {
      intersection += 1;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function polarity(text) {
  if (/(しない|禁止|avoid|do not|never|must not|不可)/i.test(text)) {
    return 'negative';
  }
  if (/(する|推奨|use|always|must|実施)/i.test(text)) {
    return 'positive';
  }
  return 'neutral';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeId(category, idHint, used) {
  const fallback = `${category}.rule`;
  const raw = String(idHint || fallback).toLowerCase();
  const withCategory = raw.includes('.') ? raw : `${category}.${raw}`;
  let safe = withCategory.replace(/[^a-z0-9._-]/g, '_').replace(/_+/g, '_');
  if (!safe.startsWith(`${category}.`)) {
    safe = `${category}.${safe.replace(/\./g, '_')}`;
  }

  let candidate = safe;
  let seq = 2;
  while (used.has(candidate)) {
    candidate = `${safe}_${seq}`;
    seq += 1;
  }
  used.add(candidate);
  return candidate;
}

function buildUpdateAction(target, candidate, score) {
  return {
    type: 'update_existing',
    target_id: target.id,
    updates: {
      rationale_append: candidate.rationale || '',
      examples_append: candidate.examples || { good: [], bad: [] },
      sources_append: asArray(candidate.sources).map((s) => ({
        path: s.path || '',
        quote: s.quote || '',
      })),
    },
    justification: `候補は既存ルールと近義（similarity=${score.toFixed(2)}）のため text は維持し、根拠と例を追記する。`,
  };
}

function buildConflictAction(candidate, target, score) {
  return {
    type: 'conflict',
    candidate_id_hint: candidate.id_hint || '',
    conflicts_with_ids: [target.id],
    note: `候補と既存ルールの極性が逆で衝突の可能性があります（similarity=${score.toFixed(2)}）。`,
  };
}

function buildDropAction(candidate, reason) {
  return {
    type: 'drop',
    candidate_id_hint: candidate.id_hint || '',
    reason,
  };
}

function buildCreateAction(candidate, resolvedId) {
  return {
    type: 'create_new',
    new_atom: {
      id: resolvedId,
      category: candidate.category,
      priority: candidate.priority,
      text: candidate.text,
      rationale: candidate.rationale || '',
      examples: candidate.examples || { good: [], bad: [] },
      sources: asArray(candidate.sources).map((s) => ({
        path: s.path || '',
        quote: s.quote || '',
      })),
      status: candidate.status || 'experimental',
      review_after_days: candidate.review_after_days || 30,
    },
    justification: '既存SSOTに近義ルールがないため新規追加する。',
  };
}

function reconcileCandidates({ existingAtoms, candidates, maxMustAdditions }) {
  const actions = [];
  const usedIds = new Set(existingAtoms.map((a) => a.id).filter(Boolean));
  let mustAdditionsCount = 0;

  for (const candidate of candidates) {
    const targetSimilarity = existingAtoms
      .map((atom) => ({
        atom,
        score: jaccard(candidate.text, atom.text),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!targetSimilarity) {
      const newId = normalizeId(candidate.category, candidate.id_hint, usedIds);
      if (candidate.priority === 'must' && mustAdditionsCount >= maxMustAdditions) {
        actions.push(buildDropAction(candidate, `must 追加上限 (${maxMustAdditions}) を超えるため保留`));
        continue;
      }
      if (candidate.priority === 'must') {
        mustAdditionsCount += 1;
      }
      actions.push(buildCreateAction(candidate, newId));
      continue;
    }

    const { atom: nearest, score } = targetSimilarity;
    const candidatePolarity = polarity(candidate.text);
    const nearestPolarity = polarity(nearest.text);
    const isConflict = score >= 0.45 && candidatePolarity !== 'neutral' && nearestPolarity !== 'neutral' && candidatePolarity !== nearestPolarity;

    if (isConflict) {
      actions.push(buildConflictAction(candidate, nearest, score));
      continue;
    }

    if (score >= 0.58) {
      actions.push(buildUpdateAction(nearest, candidate, score));
      continue;
    }

    const newId = normalizeId(candidate.category, candidate.id_hint, usedIds);
    if (candidate.priority === 'must' && mustAdditionsCount >= maxMustAdditions) {
      actions.push(buildDropAction(candidate, `must 追加上限 (${maxMustAdditions}) を超えるため保留`));
      continue;
    }
    if (candidate.priority === 'must') {
      mustAdditionsCount += 1;
    }
    actions.push(buildCreateAction(candidate, newId));
  }

  return {
    plan: {
      actions,
    },
    meta: {
      must_additions_count: mustAdditionsCount,
      must_additions_limit: maxMustAdditions,
    },
  };
}

module.exports = {
  reconcileCandidates,
};
