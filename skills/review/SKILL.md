---
description: relay review step. Reviews the whole change and writes numbered findings (review.md), then fixes only the findings the human picks.
disable-model-invocation: true
---

# relay: review

Review the whole change of this Work and write numbered findings in `review.md` in the task directory. Then, in this same session, fix only the findings the human picks in the terminal.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- `fix.md` and `rca.md`, at the paths in `context.md`. On the S path there is no `rca.md`.
- Review the change from the base commit (from `context.md`) to now: `git diff <base commit>`.

## What to look at

- Does the change fit the intent's `목표` and `비목표`?
- Where does it depart from the fix direction in `rca.md`?
- Missing cases and edge conditions.
- Do the tests really catch the fix?
- The repo's conventions and readability.
- Changes that are not needed.

Do not judge the 완료조건. That is the job of verify.

## Order

1. Review, and write each finding under `## 지적` as a numbered item: severity (차단 / 권장 / 사소), file and line, what is wrong and what you suggest. If there is nothing, write "없음". Until the human picks, `## 반영` is "없음" and `## 반영하지 않은 지적` lists every finding number. Close with the closing procedure (`awaiting_approval`).
2. When the human names findings by number in the terminal, fix only those and commit. Run the intent's test command, and for each failure check whether it also fails at the base commit. Fill in `## 반영` (what you did, the commit, the test command and result) and `## 반영하지 않은 지적`, then run the closing procedure again.
3. Never fix a finding the human did not pick, even a small one. If the human approves without picking, no finding is applied.

## Rules

- **Code:** Change code only for the findings the human picked. Commit those changes before you close. Revert any other experimental change.
- **Do not review again** after applying the picked findings. Do not add new findings.
- **Going back:** if the fix direction itself is wrong, write it as a finding and set `recommended_next` to `fix`, or to the step that wrote `rca.md` (`rca` or `investigate`, whichever is in the selectable next steps). The app stops and the human picks the step.

## Human decision: which findings to apply

This is the exception to asking on the spot. Do not ask with `AskUserQuestion`: close first, and the human picks findings in the terminal after reading `review.md`. When they do, record both what they picked and what they did not in `decisions` with `by: human`.

## Decision points

- How to fix a picked finding. With 결정마다 확인, ask before you change code.

## Done when

- `review.md` has all three template sections.
- If the human picked findings: you fixed them, committed, ran the test command, and wrote the result in `반영`.

## Artifact template: `review.md`

```markdown
## 지적
1. [차단 / 권장 / 사소] 파일:줄 — 무엇이 문제인지와 제안
(지적이 없으면 "없음")

## 반영
- 지적 번호 — 한 일, 커밋, 테스트 명령과 결과
(사람이 고른 것이 없으면 "없음")

## 반영하지 않은 지적
- 지적 번호
(없으면 "없음")
```
