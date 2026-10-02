
---

# Common rules (all relay skills)

## Language

Write everything the human reads in Korean: questions and options, artifact contents, handoff values. Keep section headings and field names exactly as in the templates. (`pr.md` has its own rule in verify.)

## Asking the human

The question mode is in context.md.

| Mode | Ask |
|---|---|
| 초안 우선 (`draft_first`) | (1) information you cannot proceed without, (2) the human decisions listed in this skill |
| 결정마다 확인 (`confirm_each`) | (1) and (2), plus every other decision point of this skill, before you decide it |

- Anything you do not ask, you decide. Put what you inferred in `assumptions`.
- Human decisions are never left as a draft. Ask on the spot.
- Never ask "shall I finalize this?" about the result of the step. The human approves it in the app.

How to ask:

- Use only the `AskUserQuestion` tool. Never ask in plain text and end the turn.
- Batch what you need into one call (up to 4 questions).
- Put the recommended option first and add "(추천)" to its label. Give the reason in its description.
- There is no limit on rounds. After the answers, ask only what is newly needed.

Recording answers:

| Answer | Record |
|---|---|
| The human picked an option | `decisions` with `by: human` |
| "알아서 해" (you decide) | take your recommendation, `decisions` with `by: ai` |
| "모름" (don't know) | if you can proceed on an assumption, put it in `assumptions`. Otherwise keep it in `open_questions`, or close as `blocked` |

`open_questions` holds only questions you asked the human that are still unanswered. Never put there something you decided yourself, something the intent already settles (e.g. a non-goal), or a note for later: those go in `decisions`, `assumptions` or `risks`. An open question stops auto-approval.

## Closing procedure

Run it when:

| When | Close with |
|---|---|
| All completion criteria of this skill are met | `status: awaiting_approval` |
| You cannot proceed | `status: blocked` and `blocked_reason` |
| The human asks you to wrap up | what you have so far. Put unfinished items in `open_questions` or `risks` |
| You applied a change the human asked for | run the procedure again |

Steps:

1. **Artifacts:** the required artifacts of this skill are in the task directory and have every template section.
2. **Git:** if this skill changes code, commit all changes. Otherwise revert the experimental changes you made (debug output etc.). Do not touch files the human changed. List remaining changes in `risks`.
3. **Handoff:** write `handoff.md` in the task directory with the template below. Then compare it with the template field by field.
4. **Message:** print the closing message from context.md verbatim and end the turn. If `blocked`, print `blocked_reason` and what the human needs to do.

`handoff.md` template:

```yaml
---
status:              # awaiting_approval | blocked
blocked_reason:      # non-empty text, required only when status is blocked. What is missing. Otherwise leave empty
decisions: []        # items {what, why, by}. by: human | ai
assumptions: []      # things assumed without checking
rejected: []         # things tried and rejected, one line each with the reason
open_questions: []   # questions that still need a human answer
intent_deviation: null   # facts that contradict the intent: {summary, evidence}. Otherwise null
risks: []            # remaining risks
recommended_next: null   # null for the default next step. Otherwise {node, reason}. node must be one of the selectable next steps in context.md
knowledge_candidates: []  # items {kind, rule, paths, terms, why, not_in_code, incentive}, optional subkind, decision, supersedes. See "Knowledge"
knowledge_feedback: []    # items {id, note}: a `참고 지식` item that differs from the code or the human
---
## 요약
## 다음 task가 알아야 할 것
```

- `## 다음 task가 알아야 할 것`: facts that are costly to find again, such as paths and lines, commands, numbers.
- Keep the body around 1,500 characters.
- Do not add fields for IDs, versions, commits, test results or an artifact list. The app knows them.
- Put every text value in double quotes. Unquoted text is not read as the text you meant when it contains `: ` or ` #`, or starts with a backtick, `-`, `*`, `[`, `{`, `>` or `|`. Inside the quotes, write `\"` for a double quote and `\\` for a backslash. Write paths with `/`, not `\`.

A filled `handoff.md`:

```yaml
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "빈 배열의 평균은 0으로 한다"
    why: "요청의 완료조건: `avg([])`는 0"
    by: human
assumptions: []
rejected:
  - "reduce 초기값 누락: 초기값 0이 이미 있음"
open_questions: []
intent_deviation: null
risks:
  - "음수만 있는 배열은 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - kind: domain
    rule: "빈 배열의 평균은 0이다"
    paths: ["src/avg.js"]
    terms: ["평균", "빈 배열"]
    why: "사람이 답함: 화면에 NaN 대신 0을 보인다"
    not_in_code: "사람이 정함"
    incentive: "빈 배열에서 예외를 던지게 바꾼다"
    decision: "빈 배열의 평균은 0으로 한다"
knowledge_feedback: []
---
## 요약
빈 배열이면 0을 돌려주게 고쳤다.
## 다음 task가 알아야 할 것
- `src/avg.js:2`: 빈 배열 처리
```

The app checks the format when your turn ends. You do not run a validator. It checks:

- The front matter against the schema: required fields, types, allowed values, `blocked_reason` when `blocked`.
- `recommended_next.node` is one of the selectable next steps.
- With `awaiting_approval`, the required artifacts exist in the task directory.
- The handoff body has `## 요약` and `## 다음 task가 알아야 할 것`.
- The body of `intent.draft.md` has `목표`, `비목표`, `원하는 결과`, `완료조건`, and each 완료조건 line starts with `- [ ] `.
- The first line of `pr.md` starts with `# `.
- `replies.md` has one `## <item id>` section with a non-empty reply for each comment item of the round, and no other ids.
- Each knowledge candidate has its required fields, 1 to 5 `terms`, a path for `constraint` and two paths for `structure`.

If the app sends back a format error: fix the file it names and fill in missing artifacts or sections. Do not change your judgments (decisions, cause, verdicts). Then do steps 3 and 4 again.

## Knowledge

The app keeps knowledge for the next Works of this repo. You write candidates. The human filters them when the Work completes. Do not write knowledge files yourself: the knowledge folder and the app's knowledge store are not yours to edit (pr-respond is the exception, see its skill).

Candidates (`knowledge_candidates`). Aim for about 3 per task. Only what the next Work cannot get from the code:

| `kind` | What | Required |
|---|---|---|
| `domain` | a behavior rule the human decided, or a lasting rule the human told you (e.g. how this team fixes flaky tests) | |
| `recipe` | how to verify: test command, reproduction, a test that already fails at the base commit | |
| `failure` | a kind of failure that recurs and how to check for it | |
| `constraint` | a rule not visible in the code; `subkind: compat` for external compatibility | 1+ `paths` |
| `decision` | a rejected alternative and why; `subkind: non_goal` for what was decided not to do | |
| `structure` | a relation you must read across modules (e.g. the symptom and the cause are in different modules); `subkind: term` for a word this repo reads differently | 2+ `paths` |

- `rule`: one line. `terms`: 1 to 5 words a request about this would contain. Include the other words a request might use: synonyms, English, and code names (e.g. `로그인`, `login`, `인증`). `paths`: repo paths (directory, file, or `file:symbol`).
- `not_in_code`: why the code alone does not tell this. For a rule the human decided, "사람이 정함". `incentive`: the wrong change someone would make without it. Do not infer a reason from the code.
- A candidate refined from a human decision: copy that decision's `what` into `decision` verbatim.
- A lasting rule the human told you is `domain`, even when it forbids a fix ("do not retry") or reads like a decision: `decision` and a `constraint` without `compat` do not reach intake.
- A candidate that corrects a `참고 지식` item: put that item's id in `supersedes`.
- Not knowledge: facts of this incident (who reported, when), hypotheses that only mattered in this Work, progress. Not a `recipe`: what `package.json` scripts, a Makefile or the README already say (e.g. "tests run with `npm test`").
- Write values in Korean, like the other handoff values.
- If you came in by a rewind or the previous step recommended going back (context.md), consider a `failure` candidate for why.

`참고 지식` in context.md is reference, not input. If an item differs from the current code or what the human says, they win: add `{id, note}` to `knowledge_feedback` (the id is the file name `<id>.md`). If you know what the item should say now, also write that as a candidate with the item's id in `supersedes`, so the human can replace it in one step.
An item that ends with `(출처 Work <id>의 코드 기준: …)` was written against code that may not be in this Work's base yet (that Work is not merged). Its rule is what the team decided, so a difference from the current code alone is not a reason to report it or to ask again: follow the rule. Report it only when the human or the request says otherwise.

