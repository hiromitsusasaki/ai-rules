# ai-rules

個人用 AI エージェント運用ルールを `atoms/*.yaml` で一元管理し、入力ログから提案を作成して手動承認で反映する CLI です。

## 設計思想

- SSOT は `atoms/*.yaml`
- SSOT を自動改変しない（必ず提案止まり）
- `inbox/` `proposals/` `dist/` を残して追跡可能にする

## ディレクトリ

- `atoms/`: 正本ルール
- `inbox/`: 取り込みログ（URL/テキスト/stdin/file）
- `proposals/`: 候補・計画・パッチ・要約
- `dist/`: ターゲット別生成物
- `config/config.yaml`: 設定

## コマンド

- `node ./bin/ai-rules ingest <url>`
- `node ./bin/ai-rules ingest --stdin`
- `node ./bin/ai-rules ingest --text "<text>"`
- `node ./bin/ai-rules ingest --file <path>`
- `node ./bin/ai-rules propose --last`
- `node ./bin/ai-rules propose <inbox_path>`
- `node ./bin/ai-rules build`
- `node ./bin/ai-rules install`
- `node ./bin/ai-rules doctor`
- `node ./bin/ai-rules status`

## 基本ワークフロー

1. 取り込み: `ingest`
2. 提案作成: `propose`
3. `proposals/<id>/summary.md` と `proposals/<id>/patch.diff` をレビュー
4. 承認した差分を手動適用
5. 生成: `build`
6. 同期: `install`
7. 健全性確認: `doctor` / `status`

## 設定例

`config/config.yaml`

```yaml
propose:
  max_must_additions: 3
patch:
  mode: diff
install:
  mode: symlink
  on_conflict: error
targets:
  enabled:
    - chat
    - coding-agent
    - openclaw
install_destinations:
  chat: "~/.config/ai-rules/targets/chat/custom_instructions.txt"
  coding-agent: "~/.config/ai-rules/targets/coding-agent/CLAUDE.md"
  openclaw: "~/.config/ai-rules/targets/openclaw/skills/personal-constitution/SKILL.md"
```

## 関連ドキュメント

- `docs/requirement.md`
- `docs/design.md`
- `docs/prompt-spec.md`
- `docs/atoms-guide.md`
- `docs/propose-notes.md`
