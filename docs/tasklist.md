フェーズ0: リポジトリ初期化
	•	ai-rules 用のリポジトリ/ディレクトリ作成（~/.config/ai-rules想定）
	•	Node/TSプロジェクト初期化（lint/format任意）
	•	ディレクトリ作成: atoms/ inbox/ proposals/ templates/ dist/ config/ scripts/
	•	config/config.yaml 雛形作成
	•	atomsスキーマのJSON Schemaまたは型定義作成

フェーズ1: ingest 実装
	•	ai-rules ingest <url> 実装
	•	HTTP GET
	•	HTML→本文抽出（Readability）
	•	正規化inbox.md保存（frontmatter + Content）
	•	抽出失敗時のフォールバック保存
	•	ai-rules ingest --stdin 実装
	•	ai-rules ingest --text 実装
	•	ai-rules ingest --file 実装
	•	ai-rules status に ingest 履歴（直近N件）表示

フェーズ2: atoms ローダ/バリデーション
	•	atoms/*.yaml ローダ実装
	•	バリデーション（必須項目、enum、id重複）
	•	ai-rules doctor 実装（ここまでのチェックを出す）

フェーズ3: propose（Distillのみ）実装
	•	ai-rules propose <inbox_path> 実装
	•	inbox読み込み（Content抽出）
	•	LLM呼び出しで候補atoms（candidates.yaml）生成
	•	proposals/<id>/summary.md 生成（候補一覧＋根拠スニペット）
	•	ai-rules propose --last 実装（最新inboxを選択）

フェーズ4: reconcile（最小差分化）実装
	•	候補atomsと既存atomsを突き合わせるロジック実装
	•	同義統合（既存更新優先。examples/rationaleを足す）
	•	新規追加
	•	衝突検出（conflictsに記録）
	•	must追加上限チェック
	•	proposals/<id>/plan.yaml 生成

フェーズ5: patch 生成/適用
	•	unified diff生成（patch.diff）
	•	patch.mode=diff の場合: diffだけ生成
	•	patch.mode=branch の場合:
	•	ブランチ作成
	•	差分適用
	•	コミットは任意（フラグでON/OFF）
	•	proposals/<id>/summary.md に「何が変わるか（最小差分）」を明記

フェーズ6: build（ターゲット生成）
	•	ターゲット定義（config）
	•	Chat UI向け生成: dist/chat/custom_instructions.txt
	•	Coding Agent向け生成: dist/claude-code/CLAUDE.md（一般化してもよい）
	•	OpenClaw向け生成:
	•	dist/openclaw/skills/personal-constitution/SKILL.md
	•	frontmatter + 本文整形（カテゴリ別）
	•	ai-rules build 実装

フェーズ7: install（同期）
	•	同期先パス定義（config）
	•	symlinkでの同期実装（デフォルト）
	•	既存ファイル衝突時の挙動（エラー/バックアップ）
	•	ai-rules install 実装
	•	ai-rules doctor にリンク切れ検査を追加

フェーズ8: 運用改善（任意）
	•	ai-rules status に未レビューproposal一覧を追加
	•	experimentalの review_after 超過検出
	•	ルール長過多の検出と警告
	•	テンプレ拡張（Cursor/Codex/Gemini等）追加

フェーズ9: ドキュメント整備
	•	README（使い方、ワークフロー、設計思想）
	•	atomsガイド（書き方、命名規則、カテゴリ運用）
	•	提案生成（propose）の注意点（動的サイト、Xはコピペ推奨等）
