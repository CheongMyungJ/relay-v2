---
description: relay verify step. Reviews the whole change, applies the findings the human picks, judges each completion criterion and drafts the PR (verification.md, pr.md).
disable-model-invocation: true
---

# relay: verify

Review the whole change of this Work, apply only the findings the human picks, then judge each 완료조건 of the intent on the final code. Write `verification.md` (the review and the verdicts) and the PR draft `pr.md` in the task directory. The approval screen of this step is the Work completion screen, and it is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- `fix.md` at the path in `context.md`: the reproduction steps (`## 재현`), the cause, the change and the reproduction test.
- The change to review is from the base commit (from `context.md`) to now: `git diff <base commit>`.

## Order

1. **Review.** Write each finding under `## 리뷰 지적` of `verification.md` as a numbered item: severity (차단 / 권장 / 사소), file and line, what is wrong and what you suggest. If there is nothing, write "없음".
2. **Pick findings** (human decision below). Skip this if there are no findings.
3. **Apply** only the picked findings, commit, and run the intent's test command. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not review again afterwards, and do not add new findings.
4. **Verify** each 완료조건 on the final code and fill in the rest of `verification.md`.
5. **Write `pr.md`**, then close.

## What to review

- Does the change fit the intent's `목표` and `비목표`?
- Does the change match the cause in `fix.md`? Does it fix the cause, or only hide the symptom?
- Missing cases and edge conditions.
- Do the tests really catch the fix?
- The repo's conventions and readability.
- Changes that are not needed.
- Code that the reproduction steps use is not unused code.

## Rules

- **Code:** change code only for the findings the human picked. Commit those changes. Revert any other experimental change when you close.
- **Reproduction steps:** do not change code that they use. If a picked finding needs it, write in `반영` how the steps change, and reproduce with the changed steps.
- **Re-run everything yourself** when you verify: the reproduction steps, the reproduction test and the test commands. Use the results in `fix.md` only for comparison.
- **Verdicts:** 통과 / 실패 / 판정 불가. For 판정 불가, give the reason, and add useful facts if any.
  For example, the reproduction test passes in a Work that never reproduced the bug. If the Work proceeded without reproduction, "재현 절차가 더 이상 실패하지 않는다" is 판정 불가. If there are neither reproduction steps nor a reproduction test, it is 판정 불가 too.
- **Changed test files:** list every test file changed since the base commit (`git diff <base commit>`), including ones the step's artifact does not mention. Mark each 약화 아님 or 약화 의심, with the reason.
- **Going back:** if the fix itself is wrong (e.g. it only hides the symptom), write it as a 차단 finding. If the human does not pick it to apply here, set `recommended_next` to `fix` with the reason. The app stops and the human picks the step.

## Decision points

- How to fix a picked finding, and the verdict of each 완료조건. With 결정마다 확인, ask before you change code and before you settle the verdicts.

## Human decisions

Ask on the spot:

- **Which findings to apply** (only when there are findings). In one question, list each finding in one line (number, severity, what). Offer: 차단·권장만 반영 / 모두 반영 / 반영하지 않음, and put the one you recommend first. The human can also type the numbers. Record what they picked and what they did not in `decisions` with `by: human`.
- **A test change looks like weakening:** show which test changed and how. If the human says it is not weakening, "기존 테스트를 약화하거나 삭제하지 않는다" is 통과. If they say it is, it is 실패.
- **Any 실패 or 판정 불가:** let the human choose:
  - Go back: set `recommended_next` to the earlier step to return to (usually `fix`). The app stops and the human picks the step.
  - Go to the completion screen as is: `recommended_next: null`. The screen shows a warning.

## Done when

- `verification.md` has all six template sections.
- If there were findings, the human picked; the picked ones are fixed and committed, and the test result is in `반영`.
- Every 완료조건 of the intent has a verdict and evidence, judged on the final code.
- Every changed test file is judged.
- `pr.md` is written.
- Any weakening suspicion, 실패 or 판정 불가 was asked about, and the answer recorded in `decisions`.

## Artifact template: `verification.md`

```markdown
## 리뷰 지적
1. [차단 / 권장 / 사소] 파일:줄 — 무엇이 문제인지와 제안
(지적이 없으면 "없음")

## 반영
- 지적 번호 — 한 일, 커밋, 테스트 명령과 결과 (재현 절차를 바꿨으면 달라진 절차)
(사람이 고른 것이 없으면 "없음")

## 반영하지 않은 지적
- 지적 번호
(없으면 "없음")

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| (완료조건 그대로) | 통과 | 실행한 명령과 결과 |

## 테스트 파일 변경
- 파일 — 약화 아님 / 약화 의심(사람 판단: …) — 이유
(바뀐 테스트 파일이 없으면 "없음")

## 남은 위험
- 
```

## Artifact template: `pr.md`

- The first line is `# <PR title>`. The app uses it as the PR title and the rest as the body.
- Write it in the language the repo uses (recent commits and PRs), not necessarily Korean.
- If the repo has a PR template (e.g. `.github/pull_request_template.md`), follow its structure. Otherwise use the sections below, in that language.

```markdown
# PR 제목

## 요약
## 원인
## 변경
## 테스트
```

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
