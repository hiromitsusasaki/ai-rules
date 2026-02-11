目的

本ドキュメントは ai-rules の Distill（候補抽出） と Reconcile（最小差分化） をLLM（Codex）に実装させるための、プロンプト入出力仕様・ガードレール・テンプレートを定義する。

本仕様の重要方針は以下。
	•	SSOT（atoms）を自動で破壊しない（必ず提案止まり）
	•	生成結果は 機械可読（YAML/JSON） を最優先
	•	「必要最低限の追記・更新」に強い（重複追加を避け、既存を極力維持）

⸻

1. 共通要件

1.1 用語
	•	SSOT: atoms/*.yaml（正本）
	•	Inbox: inbox/*.md（URL取得やコピペの正規化ログ）
	•	Proposal: proposals/<id>/*（候補、計画、パッチ、要約）
	•	Candidate: Distillで抽出された atoms 候補
	•	Plan: Reconcileで決まる「既存統合/新規追加/保留/衝突」計画

1.2 出力フォーマットの原則
	•	Distill/Reconcile の出力は 純粋なYAMLまたは純粋なJSONのみ（前後に説明文を混ぜない）
	•	YAMLの場合は --- で開始しない（ファイルの先頭からYAMLを出力）
	•	リストは明示（空配列は []）
	•	改行やインデントは標準的なYAML（2スペース）

1.3 ルール候補（atoms）の生成制約
	•	text は 原則1文、最大でも2文
	•	曖昧語（例：「適切に」「なるべく」「いい感じに」）は禁止。条件化するか削除
	•	固有ツール名・ベンダー名は原則一般化（例：Notion → 外部ツール/外部DB）
	•	事実・感想・宣伝・ストーリーはSSOTに入れない（sourcesに残すだけ）
	•	ルールは「する/しない/手順」に落とす（規範文）

1.4 カテゴリ/優先度（enum）
	•	category: style | format | thinking | research
	•	priority: must | should | may
	•	status: stable | experimental | deprecated

1.5 “最小差分”の原則（Reconcile）
	•	既存に近いものは 新規追加しない
	•	既存 text は極力変更しない
変更するなら「明確化」または「一般化」だけ（弱体化は禁止）
	•	既存へは examples / rationale / sources の追記を優先
	•	既存との衝突は自動解決しない（conflictsとして明示し、保留にする）

⸻

2. 入力としてLLMに渡す情報

2.1 Distillに渡す入力
	•	inbox_frontmatter: Inboxのfrontmatter（source_kind, source, title, published_at等）
	•	inbox_content: # Content から抽出した本文（長文可）
	•	project_constraints: 本仕様の制約（カテゴリ、ルール短文化、曖昧語禁止等）

2.2 Reconcileに渡す入力
	•	existing_atoms: 既存SSOTの要約一覧（必須）
	•	最低限：id, category, priority, text, status
	•	可能なら：rationale と examples の有無、sources の有無
	•	candidates: Distillで生成した候補atoms
	•	reconcile_config: 上限や方針（例：max_must_additions）

⸻

3. Distill（候補抽出）仕様

3.1 Distillの目的

Inboxの文章から、SSOTに入れる価値がある「共通指向性（style/format/thinking/research）」の規範を抽出し、atoms候補として構造化する。

3.2 Distillの出力（YAML）

出力は以下のYAMLドキュメント1つ。
```yaml
source:
  inbox_path: "inbox/....md"
  source_kind: "url|text|stdin|file"
  source: "https://... or user_input"
candidates:
  - id_hint: "research.primary_sources_first"
    category: "research"
    priority: "must"
    text: "不確かな情報は一次情報を優先し、発行日と参照日を明記する。"
    rationale: "誤伝播と時系列の取り違えを防ぐため。"
    examples:
      good: ["..."]
      bad: ["..."]
    sources:
      - quote: "根拠となる短い抜粋（1〜3文程度）"
        location_hint: "見出し名や段落番号など（任意）"
    status: "experimental"
    review_after_days: 30
meta:
  dropped:
    - reason: "宣伝/事実/ストーリーなど規範でない"
      quote: "..."
```
フィールド説明
	•	id_hint: 最終IDではなく候補（Reconcileで確定してよい）
	•	sources.quote: ルールの根拠となった短い抜粋（監査用）
	•	review_after_days: experimental の場合推奨（30〜90の範囲を目安）

3.3 Distillの抽出ガイド
	•	ルールとして成立する粒度だけ抽出（細かすぎる手順はexamplesへ）
	•	同種の候補が多い場合は統合して数を減らす
	•	1回のDistillで候補は最大でも15程度（上限推奨）
	•	must は乱発しない（最大でも5程度推奨）

⸻

4. Reconcile（最小差分化）仕様

4.1 Reconcileの目的

候補atomsを既存SSOTへ最小差分で畳み込み、実際に行うべき変更計画（Plan）を生成する。

4.2 Reconcileの出力（YAML）

出力は以下のYAMLドキュメント1つ。
```yaml
lan:
  actions:
    - type: "update_existing"
      target_id: "research.cite_primary_and_dates"
      updates:
        rationale_append: "..."
        examples_append:
          good: ["..."]
          bad: ["..."]
        sources_append:
          - path: "inbox/....md"
            quote: "..."
      justification: "候補は既存ルールと同義。textは変更せず根拠と例を追加。"

    - type: "create_new"
      new_atom:
        id: "thinking.assumptions_first"
        category: "thinking"
        priority: "should"
        text: "不足情報がある場合は、作業開始前に不足点を明示して追質問する。"
        rationale: "誤った前提での作業開始を防ぐため。"
        examples:
          good: []
          bad: []
        sources:
          - path: "inbox/....md"
            quote: "..."
        status: "experimental"
        review_after_days: 60
      justification: "既存SSOTに該当がなく、共通指向性として有用。"

    - type: "conflict"
      candidate_id_hint: "format.no_extra_decoration"
      conflicts_with_ids: ["style.keep_playful_tone"]
      note: "装飾禁止と遊び心の指向が矛盾する可能性。人間が統合方針を決める必要。"

    - type: "drop"
      candidate_id_hint: "..."
      reason: "プロジェクト固有/ツール固有でSSOT対象外"
meta:
  must_additions_count: 1
  must_additions_limit: 3
```
action.type
	•	update_existing: 既存atomsを更新（原則text変更しない）
	•	create_new: 新規atoms追加
	•	conflict: 矛盾/衝突が疑われ保留
	•	drop: 採用しない

4.3 Reconcileの判断基準（機械化ルール）
	•	同義/近義の判定は「textの意図」で行う（表現揺れは吸収）
	•	既存textを強化する必要がある場合のみ text_replace を提案してよい
ただし以下を満たすこと：
	•	弱体化しない
	•	範囲を不必要に狭めない
	•	変更理由を justification に明記する
	•	must 新規追加は must_additions_limit を超えない

⸻

5. Patch生成（LLMにやらせる場合の仕様）

※推奨は「LLMはPlanまで」「パッチはプログラムで生成」だが、LLMに diff を出させる場合の仕様を定める。

5.1 Patch出力（unified diff）
	•	出力は diff だけ（前後説明禁止）
	•	新規ファイルは --- /dev/null → +++ b/atoms/...
	•	既存更新は --- a/... → +++ b/...
	•	可能なら小さいhunkにする（最小差分）

5.2 Patch生成での注意
	•	YAMLの順序は原則維持（更新対象の部分だけ変える）
	•	id の変更は禁止（既存更新の際）
	•	sources 追記は配列末尾へ追加

⸻

6. 推奨プロンプトテンプレート

以下は Codex に組み込む「system/user」相当のテンプレート。実装では variables を埋めて呼び出す。

6.1 Distill Prompt（テンプレート）

指示（固定）
	•	出力はYAMLのみ
	•	候補は最大15
	•	規範だけ抽出
	•	textは1〜2文、曖昧語禁止
	•	ツール固有は一般化
	•	statusは原則experimental

テンプレート
```text
You are extracting personal global guidance rules (style/format/thinking/research) into structured YAML atoms candidates.

Hard constraints:
- Output YAML only. No prose.
- Extract only normative rules (do/don't/procedure). Drop facts, ads, stories.
- Each candidate text must be 1 sentence (max 2). No vague words.
- Categories: style, format, thinking, research.
- Priorities: must, should, may.
- Use tool/vendor-agnostic wording.
- Provide a short supporting quote for each candidate.
- Default status=experimental and set review_after_days (30-90).

Input metadata:
{{INBOX_FRONTMATTER}}

Input content:
{{INBOX_CONTENT}}

Return YAML with keys: source, candidates, meta.
```
6.2 Reconcile Prompt（テンプレート）

指示（固定）
	•	出力はYAMLのみ
	•	最小差分：既存統合優先、新規は必要最小限
	•	既存textは極力変更しない
	•	衝突はconflictとして残す

テンプレート
```text
You are reconciling candidate rule atoms into an existing SSOT of atoms with minimal diffs.

Hard constraints:
- Output YAML only. No prose.
- Prefer update_existing over create_new when meaning matches.
- Do not weaken existing rules.
- Avoid changing existing text unless necessary; prefer appending rationale/examples/sources.
- Detect conflicts; do not auto-resolve them.
- Respect must additions limit: {{MAX_MUST_ADDITIONS}}.

Existing atoms (id, category, priority, text, status):
{{EXISTING_ATOMS_SUMMARY}}

Candidates:
{{CANDIDATES_YAML}}

Return YAML with keys: plan (actions), meta.
```

⸻

7. 実装メモ（Codex向け）

7.1 既存atomsの渡し方
	•	まずは「要約（id/category/priority/text）」のみ渡す
量が増えたら、embeddingで近い候補だけ抜いて渡す（将来拡張）

7.2 安定運用のための後処理（プログラム側）
	•	生成YAMLをパースしてスキーマ検証
	•	text 長さ上限・曖昧語簡易チェック（正規表現）
	•	id_hint → 実IDの確定（命名規則適用、重複回避）
	•	Planから実ファイルのdiffを生成（推奨）

⸻

8. 命名規則（idの決め方）
	•	形式: <category>.<snake_case>
	•	意味が明確な動詞/目的語を含める
	•	research.cite_primary_and_dates
	•	thinking.state_assumptions_before_action
	•	style.be_concise_and_precise
	•	禁止: rule1, misc, random
