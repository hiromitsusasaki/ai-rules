# ai-rules USAGE

`ai-rules` の日常運用向けの使い方です。  
詳細仕様は `README.md` と `docs/` を参照してください。

## 前提

- Node.js `18` 以上
- 作業ディレクトリ: `ai-rules` リポジトリ直下

## セットアップ

### 1. 初期化（任意）

既存ルールを取り込んで開始する場合:

```bash
node ./bin/ai-rules init --source /path/to/existing/rules
```

空状態から始める場合はこの手順をスキップできます。

### 2. 現在状態の確認

```bash
node ./bin/ai-rules status
node ./bin/ai-rules doctor
```

## 基本ワークフロー

1. 取り込み: 外部情報を `inbox/` に保存
2. 提案作成: `proposals/` に候補・計画・差分を生成
3. 人手レビュー: `summary.md` / `patch.diff` を確認して手動反映
4. 生成: `dist/` を更新
5. 配置: 各ツール向けの反映先へインストール

## コマンド早見表

### ingest（入力取り込み）

URL:

```bash
node ./bin/ai-rules ingest https://example.com
```

標準入力:

```bash
node ./bin/ai-rules ingest --stdin
```

直接テキスト:

```bash
node ./bin/ai-rules ingest --text "新しい運用ルール案"
```

ファイル:

```bash
node ./bin/ai-rules ingest --file ./notes/rules.md
```

### propose（提案作成）

最新取り込みから提案:

```bash
node ./bin/ai-rules propose --last
```

`inbox` の特定ファイルから提案:

```bash
node ./bin/ai-rules propose inbox/20260208_105950_text_xxxxxxxx.md
```

生成された `proposals/<id>/` で以下を確認:

- `summary.md`
- `candidates.yaml`
- `plan.yaml`
- `patch.diff`（生成された場合）

### build（生成）

```bash
# デフォルト: claude-code, codex のみビルド
node ./bin/ai-rules build

# config の enabled 全ターゲットをビルド
node ./bin/ai-rules build --all

# カンマ区切りでターゲット指定
node ./bin/ai-rules build --targets gemini,cursor
```

`atoms/` から各ターゲット向け生成物を `dist/` に出力します。

| オプション | 動作 |
|-----------|------|
| (なし) | `claude-code`, `codex` のみビルド（config の enabled との交差） |
| `--all` | config の enabled 全ターゲットをビルド |
| `--targets <t1,t2,...>` | 指定ターゲットのみビルド（config の enabled との交差） |

config の `targets.enabled` に含まれないターゲットを指定した場合は警告を出してスキップします。

### install（反映）

```bash
node ./bin/ai-rules install
```

`config/config.yaml`（グローバル）または `.ai-rules/config.yaml`（プロジェクト）の設定に従って配備します。

`on_conflict` オプションで既存ファイルとの競合時の挙動を制御できます:

| 値 | 動作 |
|----|------|
| `backup` | 既存ファイルを `<path>.bak` にリネーム（最新1世代のみ保持） |
| `overwrite` | 既存ファイルを削除して上書き（バックアップなし） |
| `skip` | 既存ファイルをそのまま残す |

git 管理下のプロジェクトディレクトリでは `overwrite` 推奨です（バージョン履歴がバックアップの役割を果たすため）。

### status / doctor（確認）

```bash
node ./bin/ai-rules status
node ./bin/ai-rules doctor
```

- `status`: 現在の構成・生成状態を確認
- `doctor`: 設定・依存・運用上の問題を検査

## よく使う実行例

```bash
# 取り込み -> 提案 -> 生成 -> 反映
node ./bin/ai-rules ingest --text "エージェントのPRレビュー基準を明確化する"
node ./bin/ai-rules propose --last
# proposals/<id>/summary.md と patch.diff をレビューして手動反映
node ./bin/ai-rules build
node ./bin/ai-rules install
node ./bin/ai-rules doctor
```

## 補足

- SSOT は `atoms/*.yaml` です。
- `propose` は提案作成までで、SSOT の自動改変はしません。
- 提案の適用は必ず人手レビュー後に行ってください。
