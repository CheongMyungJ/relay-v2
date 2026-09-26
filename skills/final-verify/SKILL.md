---
description: relay verify step. Judges each completion criterion and drafts the PR (verification.md, pr.md).
disable-model-invocation: true
---

# relay: final-verify (verify)

Judge each 완료조건 of the intent and write `verification.md` and the PR draft `pr.md` in the task directory. The approval screen of this step is the Work completion screen, and it is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- `evidence.md` and `fix.md`, and `rca.md` if needed, at the paths in `context.md`.
- **S path** (`size: S`): there is no `evidence.md`. Use the reproduction steps in the `원인과 재현` section of `fix.md` instead. If there are neither reproduction steps nor a reproduction test, the first 완료조건 is 판정 불가.

## Rules

- **This skill does not change code.** Revert experimental changes when you close.
- **Re-run everything yourself.** Run the reproduction steps, the reproduction test and the test commands. Use the results in `fix.md` only for comparison.
- **Verdicts:** 통과 / 실패 / 판정 불가. For 판정 불가, give the reason, and add useful facts if any (e.g. the reproduction test passes in a Work that never reproduced the bug). If the Work proceeded without reproduction, "재현 절차가 더 이상 실패하지 않는다" is 판정 불가.
- **Changed test files:** list every test file changed since the base commit (`git diff <base commit>`), including ones `fix.md` does not mention. Mark each 약화 아님 or 약화 의심, with the reason.

## Decision points

- The verdict of each 완료조건. With 결정마다 확인, ask before you settle the verdicts.

## Human decisions

Ask on the spot:

- **A test change looks like weakening:** show which test changed and how. If the human says it is not weakening, "기존 테스트를 약화하거나 삭제하지 않는다" is 통과. If they say it is, it is 실패.
- **Any 실패 or 판정 불가:** let the human choose:
  - Go back: set `recommended_next` to the earlier step to return to (usually fix or rca). The app stops and the human picks the step.
  - Go to the completion screen as is: `recommended_next: null`. The screen shows a warning.

## Done when

- Every 완료조건 of the intent has a verdict and evidence.
- Every changed test file is judged.
- `pr.md` is written.
- Any weakening suspicion, 실패 or 판정 불가 was asked about, and the answer recorded in `decisions`.

## Artifact template: `verification.md`

```markdown
## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 실행한 명령과 결과 |

## 테스트 파일 변경
- 파일 — 약화 아님 / 약화 의심(사람 판단: …) — 이유
(바뀐 테스트 파일이 없으면 "없음")

## 남은 위험
- 
```

## Artifact template: `pr.md`

- The first line is `# <PR title>`. The app uses it as the PR title and the rest as the body.
- Write it in the language the repo uses (recent commits and PRs), not necessarily Korean.
- If the repo has a PR template (e.g. `.github/pull_request_template.md`), follow its structure. Otherwise use the four sections below, in that language.

```markdown
# PR 제목

## 요약
## 원인
## 변경
## 테스트
```
