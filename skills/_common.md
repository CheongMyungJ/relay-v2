
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

## Works that follow a design document

If the intent's `제약` says "`<path>`의 결정을 따른다", that design document has settled those decisions.

- Going a different way from the document touches a constraint: it is a human decision of this skill. Ask on the spot. If the change overturns a major direction, offer "멈추고 설계 Work를 먼저 함" (`blocked`).
- If the human decides to change the design, change the design document too in this task: in its decision table, record what changed, the history and that the human decided it. Commit it with the code.

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
knowledge_candidates: []  # optional. facts worth reusing later
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
knowledge_candidates: []
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

If the app sends back a format error: fix the file it names and fill in missing artifacts or sections. Do not change your judgments (decisions, cause, verdicts). Then do steps 3 and 4 again.
