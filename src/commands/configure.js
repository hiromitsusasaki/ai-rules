const readline = require('node:readline');
const { resolveApiKey, saveApiKey, CREDENTIALS_PATH } = require('../lib/credentials');

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function configureCommand() {
  const currentKey = resolveApiKey();
  if (currentKey) {
    const masked = `${currentKey.slice(0, 7)}...${currentKey.slice(-4)}`;
    console.log(`[ai-rules] 現在の API キー: ${masked}`);
  } else {
    console.log('[ai-rules] API キーが設定されていません。');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const key = await prompt(rl, 'OpenAI API キーを入力してください (空でキャンセル): ');
    if (!key.trim()) {
      console.log('[ai-rules] キャンセルしました。');
      return;
    }

    if (!key.startsWith('sk-')) {
      console.error('[ai-rules] ERROR: API キーは "sk-" で始まる必要があります。');
      return;
    }

    await saveApiKey(key.trim());
    console.log(`[ai-rules] API キーを保存しました: ${CREDENTIALS_PATH}`);
  } finally {
    rl.close();
  }
}

module.exports = {
  configureCommand,
};
