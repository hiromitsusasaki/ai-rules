# propose 運用メモ

`ai-rules propose` は `inbox/*.md` から候補抽出（Distill）と最小差分計画（Reconcile）を作り、`patch.diff` を出力します。  
この文書は提案レビュー時の注意点をまとめたものです。

## 生成物

`proposals/<id>/` に以下を出力します。

- `candidates.yaml`: 抽出候補
- `plan.yaml`: 最小差分計画
- `patch.diff`: 適用前提の unified diff
- `summary.md`: 人間向け要約

## 入力に関する注意

- 動的サイト（特に X など）は抽出失敗することがあります
- 抽出失敗時は `ingest --text` / `ingest --stdin` / `ingest --file` を使ってコピペ入力してください
- URL入力時は本文抽出結果を必ず `inbox` 側で確認してください

## レビュー時チェックリスト

- 候補は規範文になっているか（事実/感想/宣伝が混ざっていないか）
- `must` が過剰追加されていないか
- 既存との同義は `update_existing` に寄っているか
- 衝突は `conflict` で止まっているか（自動解決していないか）
- `patch.diff` が最小差分になっているか

## 推奨フロー

1. `node ./bin/ai-rules propose --last`
2. `proposals/<id>/summary.md` を読む
3. `proposals/<id>/plan.yaml` で action を確認
4. `proposals/<id>/patch.diff` をレビュー
5. 承認した変更のみ手動適用

## よくある失敗

- 1回の入力に複数テーマを混ぜて候補が散らばる
- URL本文抽出が弱く、ノイズ文が候補化される
- `id` 命名が曖昧で意味が不明確になる

入力を分割し、根拠テキストを短く明確にすると提案品質が安定します。
