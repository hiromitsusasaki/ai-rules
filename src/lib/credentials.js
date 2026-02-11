const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const CREDENTIALS_DIR = path.join(os.homedir(), '.config', 'ai-rules');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.yaml');

function resolveApiKey() {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    return envKey;
  }

  try {
    const raw = require('node:fs').readFileSync(CREDENTIALS_PATH, 'utf8');
    const match = raw.match(/^openai_api_key:\s*"?([^"\n]+)"?\s*$/m);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // credentials file not found
  }

  return null;
}

async function saveApiKey(key) {
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
  const content = `openai_api_key: "${key}"\n`;
  await fs.writeFile(CREDENTIALS_PATH, content, { encoding: 'utf8', mode: 0o600 });
}

module.exports = {
  resolveApiKey,
  saveApiKey,
  CREDENTIALS_PATH,
};
