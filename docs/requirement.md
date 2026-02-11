目的

個人用のAIエージェント運用ルールを、単一のSSOT（atoms YAML）で管理し、外部URLやコピペ文章などの入力から「SSOTの最小差分更新案（パッチ）」を生成して手動承認で反映し、各エージェント向け設定へ効率的に展開する仕組みを提供する。

スコープ
	•	個人用（ホームディレクトリ配下で運用）
	•	SSOTは atoms（YAML）を正とする
	•	入力は URL / 生テキスト（コピペ含む）/ stdin / ローカルファイル
	•	更新は必ず「提案パッチ」まで。自動適用・自動マージはしない
	•	出力は複数エージェント向けのルール文書およびOpenClaw互換SKILL

非スコープ
	•	チーム共有のプロジェクト固有ルール（各リポジトリ側で管理する）
	•	エージェントのGUI設定画面への自動書き込み（ChatGPTのカスタムインストラクションなど）
	•	外部SaaS連携（n8n/Slack等）による自動収集（将来拡張としては可能）
	•	セキュリティスキャンやマルウェア検知の高度機能（最低限のガードレールのみ）

主要ユースケース
	1.	URLを渡して、本文を取得しinboxに保存する
	2.	コピペ文章を渡して、inboxに保存する
	3.	inboxの内容から、atomsの追加/更新案を生成し、git diffでレビューできる状態にする
	4.	承認後、各エージェント向けに生成物（dist）をビルドする
	5.	distをホーム配下の所定パスへ同期（symlink推奨）する

コマンド要件（最低限）
	•	ai-rules ingest <url>
	•	ai-rules ingest --stdin
	•	ai-rules ingest --text "<text>"
	•	ai-rules ingest --file <path>
	•	ai-rules propose <inbox_path> / ai-rules propose --last
	•	ai-rules build
	•	ai-rules install
	•	ai-rules doctor
	•	ai-rules status

データ要件
	•	正本（SSOT）: atoms/*.yaml
	•	入力ログ: inbox/*.md（削除しない。監査・根拠用）
	•	提案ログ: proposals/<id>/*（抽出結果・要約・パッチ）
	•	生成物: dist/*

atoms（YAML）スキーマ（必須項目）
	•	id（一意）
	•	category（style | format | thinking | research）
	•	priority（must | should | may）
	•	text（1〜2文。短く明確）
推奨項目
	•	rationale
	•	examples.good[] / examples.bad[]
	•	sources[]（inbox参照。少なくとも1つ推奨）
	•	status（stable | experimental | deprecated）
	•	review_after（experimental時に推奨）

inbox（正規化）フォーマット要件
	•	URL入力でもテキスト入力でも同一フォーマット
	•	frontmatterに source_kind, source, fetched_at, title 等（取れるもの）を保持
	•	本文は抽出後のテキストを # Content に格納

URL取得要件
	•	HTMLを取得し本文抽出して保存
	•	抽出失敗時は失敗を明記し、可能な範囲で全文テキストまたはHTMLを保存
	•	X等の動的サイトは失敗し得る前提。コピペ入力で代替可能とする

Reconcile（最小差分化）要件
	•	既存atomsと同義/近義なら新規追加せず統合（可能ならexamples/rationaleのみ追加）
	•	矛盾が疑われる場合は自動解決しない。提案ログに衝突として明記
	•	1回の提案で追加される must の数に上限（例: 最大3）を設ける（設定可能）

Patch生成要件
	•	git apply 可能な unified diff を生成する（ファイル追加/更新）
	•	もしくはブランチを切り、そのブランチに変更を適用する（設定で選択）
	•	自動コミットは任意（デフォルトOFF）

Build（展開）要件

ターゲット例（初期）
	•	Chat UI向け（短いinstructionsテキスト）
	•	コーディングエージェント向け（CLAUDE.md 相当の詳細）
	•	OpenClaw向け（SKILL: SKILL.md + ディレクトリ構成）
	•	将来拡張しやすいテンプレート機構を用意

Install（同期）要件
	•	dist → ホーム配下の所定パスへ同期
	•	デフォルトは symlink（安全・差分追跡しやすい）
	•	既存ファイルがある場合はバックアップ or エラー（設定で選択）

Doctor/Status要件
	•	YAML妥当性チェック（必須項目、enum、重複id）
	•	ルール長過多の検出（text上限）
	•	experimentalのreview期限超過の検出
	•	installのリンク切れ検出

期待する品質特性
	•	安全性: SSOT自動改変しない（提案止まり）
	•	再現性: inbox/proposals/distが残り追跡可能
	•	変更容易性: 新ターゲット追加がテンプレ追加で済む
	•	個人運用の快適さ: コマンドが短い、ログが見やすい
