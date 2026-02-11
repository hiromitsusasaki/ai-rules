function escapeYamlString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toFrontmatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }
    lines.push(`${key}: "${escapeYamlString(value)}"`);
  }
  lines.push('---');
  return lines.join('\n');
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return null;
  }

  const end = markdown.indexOf('\n---\n');
  if (end < 0) {
    return null;
  }

  const body = markdown.slice(4, end).trim();
  const result = {};
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    result[key] = value;
  }

  return result;
}

module.exports = {
  toFrontmatter,
  parseFrontmatter,
};
