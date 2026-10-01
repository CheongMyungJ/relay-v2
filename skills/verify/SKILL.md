---
description: relay verify step. Reviews the whole change, applies the findings the human picks, judges each completion criterion and drafts the PR (verification.md, pr.md).
disable-model-invocation: true
---

# relay: verify

Review the whole change of this Work, apply only the findings the human picks, then judge each 완료조건 of the intent on the final code. Write `verification.md` (the review and the verdicts) and the PR draft `pr.md` in the task directory. The approval screen of this step is the Work completion screen, and it is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
<!-- type: bugfix -->
- `fix.md` at the path in `context.md`: the reproduction steps (`## 재현`), the cause, the change and the reproduction test.
<!-- /type -->
<!-- type: feature -->
- `design.md` and `implement.md` at the paths in `context.md`: the user scenarios, requirements and approach, and what was implemented with the new behavior tests.
<!-- /type -->
<!-- type: refactor -->
- `refactor.md` at the path in `context.md`: the plan (target structure), the safety net and its commit hash, the change, the bugs found and the accepted differences.
<!-- /type -->
- The change to review is from the base commit (from `context.md`) to now: `git diff <base commit>`.

## Order

1. **Review.** Write each finding under `## 리뷰 지적` of `verification.md` as a numbered item: severity (차단 / 권장 / 사소), file and line, what is wrong and what you suggest. If there is nothing, write "없음".
2. **Pick findings** (human decision below). Skip this if there are no findings.
3. **Apply** only the picked findings, commit, and run the intent's test command. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not review again afterwards, and do not add new findings.
4. **Verify** each 완료조건 on the final code and fill in the rest of `verification.md`.
5. **Write `pr.md`**, then close.

## What to review

- Does the change fit the intent's `목표` and `비목표`?
<!-- type: bugfix -->
- Does the change match the cause in `fix.md`? Does it fix the cause, or only hide the symptom?
<!-- /type -->
<!-- type: feature -->
- Does the implementation fit the user scenarios, requirements and approach in `design.md`? Is `계획과 달라진 점` in `implement.md` reasonable? Do not judge requirements added in the design or non-functional requirements: write a mismatch as a finding.
<!-- /type -->
<!-- type: refactor -->
- Did any logic change in the diff (outside the differences the human accepted)? A behavior change the human did not accept is a 차단 finding. Are the structural goals met? Did the scope grow beyond the plan?
<!-- /type -->
- Missing cases and edge conditions.
<!-- type: bugfix -->
- Do the tests really catch the fix?
<!-- /type -->
<!-- type: feature -->
- Do the new behavior tests really catch the behavior?
<!-- /type -->
<!-- type: refactor -->
- Do the safety-net tests really catch the behavior of every changed place?
<!-- /type -->
- The repo's conventions and readability.
- Changes that are not needed.
<!-- type: bugfix -->
- Code that the reproduction steps use is not unused code.
<!-- /type -->

## Rules

- **Code:** change code only for the findings the human picked. Commit those changes. Revert any other experimental change when you close.
<!-- type: bugfix -->
- **Reproduction steps:** do not change code that they use. If a picked finding needs it, write in `반영` how the steps change, and reproduce with the changed steps.
- **Re-run everything yourself** when you verify: the reproduction steps, the reproduction test and the test commands. Use the results in `fix.md` only for comparison.
<!-- /type -->
<!-- type: feature -->
- **Re-run everything yourself** when you verify: the new behavior tests and the test commands. Use the results in `implement.md` only for comparison.
- **"완료조건의 각 동작을 확인하는 테스트가 있다":** for each 완료조건, check that a test exists and really checks that behavior, and run it yourself on the final code. For failing before the change, use the record in `implement.md`. A test for a 완료조건 that keeps the current behavior may pass before the change. If a behavior has no test, it is 판정 불가.
<!-- /type -->
<!-- type: refactor -->
- **Re-run everything yourself** when you verify: the safety-net tests and the test commands. Use the results in `refactor.md` only for comparison.
- **"안전망 테스트가 있고 기준 코드에서도 통과한다":** in the same worktree, check out the safety-net commit (hash in `refactor.md`) for a moment with `git checkout --detach <hash>`, run the safety-net tests, then go back with `git checkout <work branch>`. Run them on the final code too. 통과 only if both pass. Check that every changed place has a safety net that really catches its behavior. Accepted differences are exceptions. If a place had no safety net (reason in `refactor.md`), it is 판정 불가. Before you close, confirm `git branch --show-current` is the work branch.
- **"레포 밖 공개 인터페이스가 바뀌지 않는다":** judge from the diff against the base commit whether anything used outside the repo changed (exports, HTTP API, CLI arguments, stored formats and schemas). Leave out what the intent says to change.
<!-- /type -->
- **Verdicts:** 통과 / 실패 / 판정 불가. For 판정 불가, give the reason, and add useful facts if any.
<!-- type: bugfix -->
  For example, the reproduction test passes in a Work that never reproduced the bug. If the Work proceeded without reproduction, "재현 절차가 더 이상 실패하지 않는다" is 판정 불가. If there are neither reproduction steps nor a reproduction test, it is 판정 불가 too.
<!-- /type -->
- **Changed test files:** list every test file changed since the base commit (`git diff <base commit>`), including ones the step's artifact does not mention. Mark each 약화 아님 or 약화 의심, with the reason.
<!-- type: refactor -->
  An existing test that only followed an internal interface change (call names, import paths, file location, setup code) is 약화 아님. If its expected values or inputs changed, or a test disappeared, it looks like weakening: ask.
<!-- /type -->
<!-- type: bugfix -->
- **Going back:** if the fix itself is wrong (e.g. it only hides the symptom), write it as a 차단 finding. If the human does not pick it to apply here, set `recommended_next` to `fix` with the reason. The app stops and the human picks the step.
<!-- /type -->
<!-- type: feature -->
- **Going back:** if the implementation or the design is wrong, write it as a 차단 finding. If the human does not pick it to apply here, set `recommended_next` with the reason: `implement` if the implementation is wrong, `design` if the design is wrong. The app stops and the human picks the step.
<!-- /type -->
<!-- type: refactor -->
- **Going back:** if the change is wrong (e.g. it changes behavior), write it as a 차단 finding. If the human does not pick it to apply here, set `recommended_next` with the reason: `refactor` if the change is wrong, `intake` if the intent is wrong. The app stops and the human picks the step.
<!-- /type -->

## Decision points

- How to fix a picked finding, and the verdict of each 완료조건. With 결정마다 확인, ask before you change code and before you settle the verdicts.

## Human decisions

Ask on the spot:

- **Which findings to apply** (only when there are findings). In one question, list each finding in one line (number, severity, what). Offer: 차단·권장만 반영 / 모두 반영 / 반영하지 않음, and put the one you recommend first. The human can also type the numbers. Record what they picked and what they did not in `decisions` with `by: human`.
- **A test change looks like weakening:** show which test changed and how. If the human says it is not weakening, "기존 테스트를 약화하거나 삭제하지 않는다" is 통과. If they say it is, it is 실패.
- **Any 실패 or 판정 불가:** let the human choose:
<!-- type: bugfix -->
  - Go back: set `recommended_next` to the earlier step to return to (usually `fix`). The app stops and the human picks the step.
<!-- /type -->
<!-- type: feature -->
  - Go back: set `recommended_next` to the earlier step to return to (usually `implement`). The app stops and the human picks the step.
<!-- /type -->
<!-- type: refactor -->
  - Go back: set `recommended_next` to the earlier step to return to (usually `refactor`). The app stops and the human picks the step.
<!-- /type -->
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
<!-- type: bugfix -->

```markdown
# PR 제목

## 요약
## 원인
## 변경
## 테스트
```
<!-- /type -->
<!-- type: feature -->
- `동작`: what the user scenarios in `design.md` can now do. `주요 설계 결정`: the chosen way and rejected alternatives, briefly.

```markdown
# PR 제목

## 요약
## 동작
## 주요 설계 결정
## 변경
## 테스트
```
<!-- /type -->
<!-- type: refactor -->
- `목표 구조`: the new shape and rejected alternatives, briefly. `동작 보존`: safety-net counts (existing, new, passed at the safety-net commit), accepted differences, places changed without a safety net. `변경`: commits by step. `찾은 버그`: copy the bugs found (not fixed) from `refactor.md`, or "없음".

```markdown
# PR 제목

## 요약
## 목표 구조
## 동작 보존
## 변경
## 찾은 버그
## 테스트
```
<!-- /type -->
