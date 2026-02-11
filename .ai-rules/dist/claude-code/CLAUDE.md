# AIエージェントルール管理システム ルール文書 (Claude Code 向け)

## プロジェクト概要

個人用 AI エージェントルールを `atoms/*.yaml` で一元管理（SSOT）し、複数の AI ツール向けにルール文書を生成・配布する CLI。SSOT は自動改変せず、必ず提案→手動承認のフローを経る設計。

本ドキュメントは Claude Code (Anthropic CLI) 向けに最適化されています。

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

1. **Ingest**: URL/text/stdin/file から `inbox/*.md` に正規化文書を生成（frontmatter 付き）
2. **Distill**: inbox テキストから規範文を抽出し候補 atoms を構造化。LLM 不要、正規表現ベースで `isNormative()` → `inferCategory()` → `inferPriority()` の判定を行う
3. **Reconcile**: 候補 atoms と既存 atoms を Jaccard 類似度で比較し、update/create/conflict/drop に分類。`must` 追加上限あり
4. **Patch**: reconcile 計画から unified diff を生成し `proposals/<id>/patch.diff` に保存
5. **Build**: `atoms/*.yaml` からターゲット別に `dist/<target>/*` をレンダリング。Claude Code 向けには Markdown 形式を基本とし、カスタム指示書やスキル形式も対応
6. **Install**: dist ファイルを symlink またはコピーでホーム配下に同期

### 動作モード

- **Global モード**: `~/.config/ai-rules/` をルートとして atoms ベースで動作
- **Project モード**: カレントディレクトリに `.ai-rules/` がある場合に起動。`project.md` をソースとし、ターゲット別に生成。必要に応じて最適化処理を行う

### ターゲット別生成形式 (Claude Code 向け最適化)

| ターゲット       | 出力先                             | 形式・備考                                  |
|------------------|----------------------------------|--------------------------------------------|
| chat             | `dist/chat/custom_instructions.txt` | must/should のみを含むカスタム指示書（Claude Code のカスタム指示に適合） |
| 複数ツール共通   | `dist/<name>/<file>`              | 全カテゴリを構造化した Markdown ルール文書（Claude Code の Markdown パース対応） |
| 特定ツール形式1  | `dist/cursor/ai-rules.mdc`       | YAML frontmatter 付き Markdown（Claude Code でのメタデータ利用に最適） |
| 特定ツール形式2  | `dist/openclaw/.../SKILL.md`     | スキル形式ドキュメント（Claude Code のスキル管理に対応） |

### LLM連携（オプション）

- Claude Code では Anthropic API を利用可能
- 初期化時の汎用化変換、ビルド時のターゲット最適化、ingest時のマージ提案に活用
- APIキーは環境変数や設定ファイルで管理（例: `ANTHROPIC_API_KEY`）
- APIキー未設定時は LLM 不要のフォールバック動作

### Atom スキーマ

- 必須フィールド  
  - `id`  
  - `category`（style/format/thinking/research）  
  - `priority`（must/should/may）  
  - `text`（最大280文字）  
- オプションフィールド  
  - `rationale`  
  - `examples`  
  - `sources`  
  - `status`（stable/experimental/deprecated）  
  - `review_after`

## 技術スタック

- Node.js (>=18), CommonJS モジュール
- YAML パースは独自軽量パーサを使用（外部 YAML ライブラリ不使用）
- LLM 連携は Anthropic API (Claude Code) および OpenAI API に対応
- テストフレームワークは未導入

## 設定

- `config/config.yaml` にて以下を制御  
  - `propose.max_must_additions`  
  - `patch.mode`  
  - `targets.enabled[]`  
  - `install.mode`  
  - `install.destinations`  
- 設定ファイルは独自 YAML パーサで読み込み解析される

---

*本ルール文書は Claude Code 向けに最適化されており、Anthropic CLI 環境での運用を想定しています。*