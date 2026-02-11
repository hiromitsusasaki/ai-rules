# Codex CLI エージェントルール管理システム

## プロジェクト概要

Codex CLI は、個人用 AI エージェントルールを `atoms/*.yaml` で一元管理（SSOT）し、複数の AI ツール向けにルール文書を生成・配布する CLI ツールです。  
SSOT は自動改変せず、必ず提案→手動承認のフローを経る設計となっています。

## コマンド一覧

```bash
# CLI 実行（npm scripts または直接）
node ./bin/ai-rules <command>

# 主要コマンド
node ./bin/ai-rules ingest <url>          # URL からルール素材を取り込み
node ./bin/ai-rules ingest --text "..."   # テキストから取り込み
node ./bin/ai-rules ingest --stdin        # stdin から取り込み
node ./bin/ai-rules ingest --file <path>  # ファイルから取り込み
node ./bin/ai-rules propose --last        # 最新 inbox から提案生成
node ./bin/ai-rules approve --last        # 最新提案を承認（project モード）
node ./bin/ai-rules build                 # atoms → dist 生成
node ./bin/ai-rules install               # dist → ホーム配下に同期
node ./bin/ai-rules configure             # API キー設定
node ./bin/ai-rules doctor                # YAML スキーマ・リンク切れチェック
node ./bin/ai-rules status                # 未レビュー提案・期限超過表示
```

## システムアーキテクチャ

### パイプライン（6段階）

```
ingest → distill → reconcile → patch → build → install
```

1. **Ingest**  
   URL/text/stdin/file から `inbox/*.md` に frontmatter 付きの正規化文書を生成します。

2. **Distill**  
   inbox テキストから規範文を抽出し候補 atoms を構造化します。  
   LLM 不要で、正規表現ベースの `isNormative()` → `inferCategory()` → `inferPriority()` 判定を行います。

3. **Reconcile**  
   候補 atoms と既存 atoms を Jaccard 類似度で比較し、update/create/conflict/drop に分類します。  
   `must` 追加上限があります。

4. **Patch**  
   reconcile 計画から unified diff を生成し `proposals/<id>/patch.diff` に保存します。

5. **Build**  
   `atoms/*.yaml` からターゲット別に `dist/<target>/*` をレンダリングします。

6. **Install**  
   dist ファイルを symlink またはコピーでホーム配下に同期します。

### 動作モード

- **Global モード**  
  `~/.config/ai-rules/` をルートとして atoms ベースで動作します。

- **Project モード**  
  カレントディレクトリに `.ai-rules/` がある場合に起動します。  
  `project.md` をソースとし、ターゲット別に生成。必要に応じて最適化処理を行います。

### ターゲット別生成形式

| ターゲット           | 出力先                             | 形式                                 |
|----------------------|----------------------------------|------------------------------------|
| chat                 | `dist/chat/custom_instructions.txt` | must/should のみを含むカスタム指示書       |
| 複数ツール共通       | `dist/<name>/<file>`              | 全カテゴリを構造化したマークダウンルール文書 |
| 特定ツール形式1       | `dist/cursor/ai-rules.mdc`        | YAML frontmatter 付きマークダウン           |
| 特定ツール形式2       | `dist/openclaw/.../SKILL.md`      | スキル形式ドキュメント                     |

### LLM連携（オプション）

- OpenAI API などの大規模言語モデルを利用可能です。
- 初期化時の汎用化変換、ビルド時のターゲット最適化、ingest時のマージ提案に活用します。
- APIキーは環境変数や設定ファイルで管理します。
- APIキー未設定時は LLM 不要のフォールバック動作を行います。

### Atom スキーマ

- **必須フィールド**  
  - `id`  
  - `category`（style / format / thinking / research）  
  - `priority`（must / should / may）  
  - `text`（最大280文字）

- **オプションフィールド**  
  - `rationale`  
  - `examples`  
  - `sources`  
  - `status`（stable / experimental / deprecated）  
  - `review_after`

## 技術スタック

- Node.js (>=18), CommonJS モジュール
- YAML パースは独自軽量パーサを使用（外部 YAML ライブラリは使用しません）
- 唯一の外部依存は LLM 連携用の OpenAI パッケージです
- テストフレームワークは未導入です

## 設定

- `config/config.yaml` にて以下を制御します  
  - `propose.max_must_additions`  
  - `patch.mode`  
  - `targets.enabled[]`  
  - `install.mode`  
  - `install.destinations`

- 設定ファイルは独自 YAML パーサで読み込み・解析されます