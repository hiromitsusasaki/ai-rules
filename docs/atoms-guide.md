# atoms ガイド

## 目的

`atoms/*.yaml` は個人運用ルールの正本（SSOT）です。  
ここでは atom の書式・命名・運用ルールを定義します。

## 1 atom = 1 ファイル

- 推奨パス: `atoms/<id>.yaml`
- 1ファイルに1ルールを保存

## 必須項目

- `id`: 一意な識別子
- `category`: `style | format | thinking | research`
- `priority`: `must | should | may`
- `text`: 1〜2文、短く明確

## 推奨項目

- `rationale`
- `examples`（`good` / `bad`）
- `sources`
- `status`（`stable | experimental | deprecated`）
- `review_after`（`experimental` の場合推奨）

## 命名規則（id）

- 形式: `<category>.<snake_case>`
- 例:
  - `research.cite_primary_and_dates`
  - `thinking.state_assumptions_before_action`
  - `style.be_concise_and_precise`
- 禁止:
  - `rule1`
  - `misc`
  - `random`

## text 記述ルール

- 原則1文（最大2文）
- 曖昧語を避ける
  - 例: 「適切に」「いい感じに」「なるべく」
- ツール固有語は可能な限り一般化する
- 事実メモや感想は atom に入れず `inbox/` へ残す

## status 運用

- `stable`: 通常運用
- `experimental`: 試行中。`review_after` を設定
- `deprecated`: 廃止（build 出力対象外）

## 運用フロー

1. `ingest` で入力を保存
2. `propose` で候補と計画を作成
3. `patch.diff` を人間がレビュー
4. 承認後に手動で `atoms/` を更新
5. `build` / `install` で展開
