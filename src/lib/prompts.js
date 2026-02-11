const TARGET_PROFILES = {
  'claude-code': {
    name: 'Claude Code',
    format: 'Markdown (.md)',
    filename: 'CLAUDE.md',
    guidance: 'Claude Code (Anthropic CLI) 向け。CLAUDE.md として配置される。',
  },
  codex: {
    name: 'Codex CLI',
    format: 'Markdown (.md)',
    filename: 'AGENTS.md',
    guidance: 'OpenAI Codex CLI 向け。AGENTS.md として配置される。',
  },
  copilot: {
    name: 'GitHub Copilot',
    format: 'Markdown (.md)',
    filename: 'copilot-instructions.md',
    guidance: 'GitHub Copilot 向け。.github/copilot-instructions.md として配置される。',
  },
  gemini: {
    name: 'Gemini CLI',
    format: 'Markdown (.md)',
    filename: 'GEMINI.md',
    guidance: 'Google Gemini CLI 向け。GEMINI.md として配置される。',
  },
  opencode: {
    name: 'OpenCode',
    format: 'Markdown (.md)',
    filename: 'AGENTS.md',
    guidance: 'OpenCode 向け。AGENTS.md として配置される。',
  },
  cursor: {
    name: 'Cursor',
    format: 'MDC (.mdc) — YAML frontmatter + Markdown',
    filename: 'ai-rules.mdc',
    guidance: [
      'Cursor 向け。.cursor/rules/ai-rules.mdc として配置される。',
      '出力には YAML frontmatter を含めないこと（後で自動付与される）。',
      'Markdown 本文のみ出力すること。',
    ].join('\n'),
  },
  openclaw: {
    name: 'OpenClaw',
    format: 'MDC (.md) — YAML frontmatter + Markdown',
    filename: 'SKILL.md',
    guidance: [
      'OpenClaw 向けスキルファイル。',
      '出力には YAML frontmatter を含めないこと（後で自動付与される）。',
      'Markdown 本文のみ出力すること。',
    ].join('\n'),
  },
  chat: {
    name: 'Chat (Custom Instructions)',
    format: 'Plain text',
    filename: 'custom_instructions.txt',
    guidance: 'チャット AI (ChatGPT 等) のカスタムインストラクション向け。簡潔なプレーンテキスト形式。',
  },
};

function buildInitPrompt(sourceContent) {
  return [
    {
      role: 'system',
      content: [
        'あなたは AI コーディングアシスタント向けのルール文書を整理するエキスパートです。',
        '',
        '## タスク',
        'ユーザーが提供するソースファイル（特定ツール向けの設定ファイル）を、',
        'ツール非依存の汎用ルール文書に変換してください。',
        '',
        '## ルール',
        '- 特定ツール名への参照（例: "Claude Code", "Cursor", "Copilot"）を除去し、汎用的な表現に置き換える',
        '- ツール固有の設定構文（frontmatter, 特殊ディレクティブ等）を除去する',
        '- ルールの意味・意図は保持する',
        '- Markdown 形式で出力する',
        '- セクション構造を整理し、読みやすくする',
        '- 出力はルール文書の内容のみ（説明文や前置きは不要）',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下のソースファイルを汎用ルール文書に変換してください:\n\n${sourceContent}`,
    },
  ];
}

function buildTargetPrompt(projectContent, targetName, targetMeta) {
  return [
    {
      role: 'system',
      content: [
        'あなたは AI コーディングアシスタント向けのルール文書を最適化するエキスパートです。',
        '',
        '## タスク',
        `汎用ルール文書を「${targetMeta.name}」向けに最適化してください。`,
        '',
        '## ターゲット情報',
        `- ツール名: ${targetMeta.name}`,
        `- 形式: ${targetMeta.format}`,
        `- ファイル名: ${targetMeta.filename}`,
        `- ガイダンス: ${targetMeta.guidance}`,
        '',
        '## ルール',
        '- 元のルール内容は全て保持する',
        '- ターゲットツールに適した表現・構造に調整する',
        '- ターゲット固有の慣習がある場合はそれに従う',
        '- 出力はルール文書の内容のみ（説明文や前置きは不要）',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の汎用ルール文書を「${targetMeta.name}」向けに最適化してください:\n\n${projectContent}`,
    },
  ];
}

function buildIngestMergePrompt(projectContent, newContent, sourceMeta) {
  return [
    {
      role: 'system',
      content: [
        'あなたは AI コーディングアシスタント向けのルール文書を管理するエキスパートです。',
        '',
        '## タスク',
        '既存のプロジェクトルール文書に新しいコンテンツをマージした提案を作成してください。',
        '',
        '## ルール',
        '- 既存ルールの構造・スタイルを維持する',
        '- 新しいコンテンツから有用なルールを抽出して適切な場所に配置する',
        '- 重複するルールは統合する',
        '- 矛盾するルールがあれば新しいコンテンツを優先するが、その旨をコメントで示す',
        '- 出力はマージ後のルール文書全体（説明文や前置きは不要）',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '## 既存のプロジェクトルール文書',
        '',
        projectContent,
        '',
        `## 新しいコンテンツ（ソース: ${sourceMeta.source || 'unknown'}）`,
        '',
        newContent,
      ].join('\n'),
    },
  ];
}

module.exports = {
  TARGET_PROFILES,
  buildInitPrompt,
  buildTargetPrompt,
  buildIngestMergePrompt,
};
