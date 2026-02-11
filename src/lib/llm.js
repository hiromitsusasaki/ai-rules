const { resolveApiKey } = require('./credentials');

const DEFAULT_MODEL = 'gpt-4.1-mini';

async function createChatCompletion({ messages, model, temperature }) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI API キーが設定されていません。\n' +
      '環境変数 OPENAI_API_KEY を設定するか、ai-rules configure を実行してください。'
    );
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const selectedModel = model || DEFAULT_MODEL;

  try {
    const response = await client.chat.completions.create({
      model: selectedModel,
      messages,
      temperature: temperature ?? 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM からの応答が空です。');
    }

    return content;
  } catch (err) {
    if (err.status === 401) {
      throw new Error('OpenAI API 認証エラー: API キーが無効です。ai-rules configure で再設定してください。');
    }
    if (err.status === 429) {
      throw new Error('OpenAI API レート制限に達しました。しばらく待ってから再試行してください。');
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      throw new Error('ネットワークエラー: OpenAI API に接続できません。');
    }
    throw err;
  }
}

module.exports = {
  createChatCompletion,
  DEFAULT_MODEL,
};
