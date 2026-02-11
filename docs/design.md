全体構成

パイプラインを「入力アダプタ（ingest）」で統一し、以降は正規化された inbox を唯一の入力として扱う。
	•	Ingest: url/text/stdin/file → inbox/*.md
	•	Distill: inbox → 候補atoms（構造化）
	•	Reconcile: 候補atoms × 既存atoms → 最小差分案
	•	Patch: 差分を unified diff（またはブランチ適用）
	•	Build: atoms → dist（ターゲット別生成）
	•	Install: dist → ホームへ同期
	•	Doctor/Status: 健康診断/運用補助

ディレクトリ構成（推奨）

~/.config/ai-rules/
	•	atoms/（SSOT）
	•	inbox/（原文ログ）
	•	proposals/（提案ログ）
	•	templates/（ターゲット別テンプレ）
	•	dist/（生成物）
	•	config/（パスや上限、ターゲット定義）
	•	scripts/（CLI実装）

設定ファイル

config/config.yaml（例）
	•	paths.root
	•	paths.atoms/inbox/proposals/dist
	•	propose.max_must_additions
	•	patch.mode: diff | branch
	•	install.mode: symlink | copy
	•	targets.enabled[]
	•	targets.<name>.options...

Ingest詳細

入力種別
	•	URL
	•	stdin
	•	text
	•	file

出力（Normalized Inbox）
inbox/<timestamp>_<kind>_<hash>.md

frontmatter（例）
	•	source_kind: url|text|stdin|file
	•	source: "<url>" | "user_input" | "<path>"
	•	fetched_at: ISO8601
	•	title/author/published_at/updated_at（取れたら）
	•	content_type
	•	hash

本文
	•	# Content に抽出テキスト（URLは本文抽出後）
	•	# Notes は任意（将来：ユーザー補足）

URL本文抽出
	•	HTTP GET
	•	HTML → readability系の本文抽出
	•	失敗時は「抽出失敗」を明記して、可能な範囲のテキスト/HTMLを保存

Distill（候補抽出）詳細

入力: inbox/*.md の Content
出力: proposals/<id>/candidates.yaml

出力は atoms スキーマに準拠しつつ、status は原則 experimental で開始し、reconcile後に stable へ昇格可。

抽出ポリシー
	•	規範（すべき/する/しない）だけ
	•	1〜2文に圧縮
	•	曖昧語は条件化か除去
	•	固有ツール名は一般化（可能なら）

Reconcile（最小差分化）詳細

目的: 既存SSOTの更新は「最小限」にする。

手順案
	1.	既存atomsの一覧を読み込み
	2.	候補ごとに統合先を決める
	•	同義/近義: 既存更新（textは極力変えない。examples/rationale追加優先）
	•	新規: atoms追加
	•	衝突: conflictsとして提案ログに記録し、更新は保留または別案として提示
	3.	上限チェック（例: must追加最大3）
	4.	結果を proposals/<id>/plan.yaml に保存

統合判定（初期実装）
	•	ルール text をLLMに渡して「最も近い既存id」を選ばせる方式
将来拡張
	•	embeddingで候補を絞ってからLLMで最終判定

Patch生成

出力
	•	proposals/<id>/patch.diff（unified diff）
	•	proposals/<id>/summary.md（変更意図、候補、衝突、根拠スニペット）

オプション
	•	patch.mode=branch の場合
	•	rules/propose/<id> ブランチ作成
	•	差分を適用（コミットは任意）

Build（ターゲット別生成）

入力: atoms/*.yaml
出力: dist/<target>/*

ターゲットの生成戦略
	•	Chat UI: must/should中心、短く整形（examplesは省略）
	•	Coding Agent: must/should + examples + rationale を含む構造化Markdown
	•	OpenClaw: 「個人憲法」スキルとして1スキルに集約して生成
	•	dist/openclaw/skills/personal-constitution/SKILL.md
	•	YAML frontmatter（name, description 等）+ 本文（カテゴリごとに列挙）

テンプレート方式
	•	templates/<target>/* を用意し、atomsを差し込む
	•	target固有の上限（文字数など）は options で制御

Install（同期）
	•	dist からホーム配下の所定パスへ同期
	•	symlink推奨（安全、更新が軽い）
	•	既存ファイル衝突時のポリシー
	•	エラー（デフォルト）
	•	バックアップして置換（オプション）

Doctor/Status

Doctor
	•	YAMLスキーマチェック
	•	id重複
	•	text長すぎ
	•	enum不正
	•	installリンク切れ
Status
	•	未レビューの proposal 一覧
	•	experimental で review_after 超過
	•	最近の ingest 履歴

技術スタック（推奨）
	•	Node.js + TypeScript
	•	CLI: commander 等
	•	YAML: yaml
	•	diff生成: diff ライブラリ or git diff --no-index
	•	URL取得: undici 等
	•	本文抽出: @mozilla/readability + jsdom 等
	•	LLM呼び出し: Codex上で実行される前提のクライアント（環境変数でAPIキー）
	•	“LLMを使わないモード”も用意（提案なし、ingestのみ）
