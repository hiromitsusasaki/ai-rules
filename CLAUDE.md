# AIエージェントルール管理システム ルール文書 (Claude Code 向け)

## プロジェクト概要

個人用 AI エージェントルールを `atoms/*.yaml` で一元管理（SSOT）し、複数の AI ツール向けにルール文書を生成・配布する CLI。SSOT は自動改変せず、必ず提案→手動承認のフローを経る設計。

本ドキュメントは Claude Code (Anthropic CLI) 向けに最適化されています。  
生成されるルール文書は `dist/claude_code/` 配下に配置されます。

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
node ./bin/ai-rules build                 # デフォルト: claude-code, codex のみ
node ./bin/ai-rules build --all           # config の enabled 全ターゲット
node ./bin/ai-rules build --targets t1,t2 # カンマ区切りで指定
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
5. **Build**: `atoms/*.yaml` からターゲット別に `dist/<target>/*` をレンダリング  
6. **Install**: dist ファイルを symlink またはコピーでホーム配下に同期  

### 動作モード

- **Global モード**: `~/.config/ai-rules/` をルートとして atoms ベースで動作  
- **Project モード**: カレントディレクトリに `.ai-rules/` がある場合に起動。`project.md` をソースとし、ターゲット別に生成。必要に応じて最適化処理を行う  

### ターゲット別生成形式

| ターゲット        | 出力先                             | 形式                                             |
|-------------------|----------------------------------|--------------------------------------------------|
| claude_code       | `dist/claude_code/custom_instructions.txt` | must/should のみを含む Claude Code 用カスタム指示書（プレーンテキスト） |
| chat              | `dist/chat/custom_instructions.txt`          | must/should のみを含むカスタム指示書               |
| 複数ツール共通    | `dist/<name>/<file>`                         | 全カテゴリを構造化したマークダウンルール文書       |
| 特定ツール形式1   | `dist/cursor/ai-rules.mdc`                    | YAML frontmatter 付きマークダウン                  |
| 特定ツール形式2   | `dist/openclaw/.../SKILL.md`                   | スキル形式ドキュメント                             |

### Claude Code 向け生成の特徴

- must/should のルールのみを抽出し、簡潔なテキスト形式で出力  
- 280文字以内の `text` フィールドを中心に構成  
- YAML frontmatter は含めず、純粋なプレーンテキスト指示書として生成  
- 生成ファイルは `dist/claude_code/custom_instructions.txt` に配置  

### LLM連携（オプション）

- OpenAI API などの大規模言語モデルを利用可能  
- Claude Code API 連携も想定し、APIキーは環境変数や設定ファイルで管理  
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
- 唯一の外部依存は LLM 連携用の OpenAI パッケージ（Claude Code API 連携は別途対応予定）  
- テストフレームワークは未導入  

## 設定

- `config/config.yaml` にて以下を制御  
  - `propose.max_must_additions`  
  - `patch.mode`  
  - `targets.enabled[]`（`claude_code` を有効化可能）  
  - `install.mode`  
  - `install.destinations`  
- 設定ファイルは独自 YAML パーサで読み込み解析される