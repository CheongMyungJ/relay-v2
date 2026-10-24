---
description: relay verify step. Reviews the whole change, applies the findings the human picks, judges each completion criterion and drafts the PR (verification.md, pr.md).
---

# relay: verify

Review the whole change of this Work, apply only the findings the human picks, then judge each 완료조건 of the intent on the final code. Write `verification.md` (the review and the verdicts) and the PR draft `pr.md` in the task directory. The approval screen of this step is the Work completion screen, and it is always manual.

## Inputs

- relay gives you the path of `context.md` when the step starts. Read it first. It has the intent and the Work's base commit.
<!-- type: bugfix -->
- `fix.md` at the path in `context.md`: the reproduction steps (`## 재현`), the cause, the change and the reproduction test.
<!-- /type -->
<!-- type: feature -->
- `design.md` and `implement.md` at the paths in `context.md`: the user scenarios, requirements and approach, and what was implemented with the new behavior tests.
<!-- /type -->
<!-- type: refactor -->
- `refactor.md` at the path in `context.md`: the plan (target structure), the safety net and its commit hash, the change, the bugs found and the accepted differences.
<!-- /type -->
<!-- type: spec -->
- `spec.md` at the path in `context.md`: the topic list, the Q&A record, what was checked, and the document changes. The target document: its path is in the intent's `제약`. The spec handoff is `직전 handoff` in `context.md`.
<!-- /type -->
<!-- type: general -->
- `execution.md` at the path in `context.md`: the plan, the change, and the self-check of each 완료조건.
<!-- /type -->
<!-- type: custom -->
- The artifacts of the custom steps (`<step id>.md`, one per step) at the paths in `context.md`: what each step did and its self-check. The steps of this Work type are in `context.md` (`## 커스텀 유형`).
<!-- /type -->
- The change to review is from the base commit (from `context.md`) to now: `git diff <base commit>`.

## Order

1. **Review.** Write each finding under `## 리뷰 지적` of `verification.md` as a numbered item: severity (차단 / 권장 / 사소), file and line, what is wrong and what you suggest. If there is nothing, write "없음".
2. **Pick findings** (human decision below). Skip this if there are no findings.
<!-- type: bugfix feature refactor general custom -->
3. **Apply** only the picked findings, commit, and run the intent's test command. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not review again afterwards, and do not add new findings.
<!-- /type -->
<!-- type: spec -->
3. **Apply** only the picked findings to the document and commit. There is no test command to run. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not review again afterwards, and do not add new findings.
<!-- /type -->
4. **Verify** each 완료조건 on the final code and fill in the rest of `verification.md`.
5. **Write `pr.md`**, then close.

<!-- type: bugfix feature refactor general custom -->
## How to review

Review in this order:

1. **Scope:** the change from the base commit to now, uncommitted changes included (`git diff <base commit>`).
2. **Find candidates:** go through every angle of `## What to review`, one after another. Do not let one angle's conclusion suppress another's: if two angles flag the same line for different reasons, keep both. Each candidate has a file and line, a one-line summary, and a failure scenario: the concrete input or state, and what goes wrong (a wrong result, a crash, a broken caller). For a cleanup candidate (reuse, simplification, efficiency, altitude, conventions), state the concrete cost instead: what is duplicated, wasted or harder to maintain, or which rule it breaks. Pass every candidate that has a nameable failure scenario on to the check. Do not drop one because you only half believe it: dropping half-believed candidates here is the main cause of missed defects. Keep out-of-scope problems apart, for `나중에 정리할 곳`.
3. **Dedup:** candidates with the same defect, location and reason are one. Keep the one with the most concrete failure scenario.
4. **Check** each remaining candidate against the code, and mark it with exactly one of:
   - **확인됨:** you can name the input or state that triggers it and the wrong result. Quote the line.
   - **가능성:** the mechanism is real, but the trigger is uncertain (timing, environment, config). State what would confirm it.
   - **틀림:** the code does not say that, or it is handled elsewhere. Quote the line that proves it.

   가능성 is the default. Do not mark a candidate 틀림 for being speculative or for depending on runtime state when that state is realistic: a race, a missing value on a rare but reachable path (an error handler, an empty cache, a missing optional field), zero or empty treated as missing, off-by-one on a boundary the code does not exclude, a partial failure or retry, a pattern or allowlist that lost an anchor. Mark it 틀림 only when the code shows it: factually wrong (quote the line), impossible by a type, constant or invariant (show it), already handled in this diff (cite the guard), or pure style with no observable effect. Drop 틀림.
5. **Write** the 확인됨 and 가능성 findings under `## 리뷰 지적` (see `## Order`), each with a severity.

<!-- /type -->
## What to review

- If the intent's `제약` says to follow a design document ("`<path>`의 결정을 따른다"): does the change match its decisions? Is every decision the change departs from also changed in that document, with its history and the human's decision?
<!-- type: bugfix feature refactor general custom -->
- Does the change fit the intent's `목표` and `비목표`?
<!-- /type -->
<!-- type: spec -->
- Review the target document, not code: its consistency and grounds. Do not judge whether a decision is good.
- Contradictions inside the document, and mismatches between the decision table and the body.
- Every statement about the current code: read the code and check them one by one.
- Decisions with no reason, or resting on a guess nobody checked.
- "<무엇>을 정한다" items of the intent that the document misses.
- Places so vague that whoever builds it would have to decide again.
- Do the human-decision marks match the spec handoff's `decisions` with `by: human`?
<!-- /type -->
<!-- type: bugfix -->
- Does the change match the cause in `fix.md`? Does it fix the cause, or only hide the symptom?
<!-- /type -->
<!-- type: feature -->
- Does the implementation fit the user scenarios, requirements and approach in `design.md`? Is `계획과 달라진 점` in `implement.md` reasonable? Do not judge requirements added in the design or non-functional requirements: write a mismatch as a finding.
- Does the change sit where `구조 맞춤` in `design.md` says?
- If something goes away: is it all gone? Look for references left, dead code, and config or docs no longer used.
<!-- /type -->
<!-- type: refactor -->
- Did any logic change in the diff (outside the differences the human accepted)? A behavior change the human did not accept is a 차단 finding. Are the structural goals met? Did the scope grow beyond the plan?
<!-- /type -->
<!-- type: general -->
- Does the change fit the plan in `execution.md`? Did the scope grow beyond it?
- Does each 완료조건's check method (`— 확인: …`) really check it?
<!-- /type -->
<!-- type: custom -->
- Does the change fit what each custom step's artifact says it did? Did the scope grow beyond it?
- Does each 완료조건's check method (`— 확인: …`) really check it?
- **The type's review points:** if these instructions end with `## This Work type's review points`, review those points too. They come from whoever defined the type.
<!-- /type -->
<!-- type: bugfix feature refactor general custom -->
- **Line by line:** read every hunk of the diff, then the whole function around it: a defect in an unchanged line of a touched function is in scope too. For each line ask what input, state, timing or platform makes it wrong. Look for missing cases and edge conditions, inverted or wrong conditions, off-by-one, a value used where it can be missing, a missing `await`, zero or empty treated as missing, a copy-pasted wrong variable, an error swallowed in a catch, an unescaped pattern.
- **Removed behavior:** for every line the diff deletes or replaces, name what it enforced, then find where the new code does it again. If nowhere, it is a candidate: a removed guard, a dropped error path, a narrowed validation, a deleted test that covered a real case.
- **Callers:** for each function the diff changes, find its callers and check whether the change breaks one: a new precondition, a changed return shape, a new error, an order dependency. Check its callees too: does another change in this diff make a call unsafe?
<!-- /type -->
<!-- type: bugfix -->
- Do the tests really catch the fix?
<!-- /type -->
<!-- type: feature -->
- Do the new behavior tests really catch the behavior?
<!-- /type -->
<!-- type: refactor -->
- Do the safety-net tests really catch the behavior of every changed place?
<!-- /type -->
<!-- type: general -->
- Does every change in code behavior have a test that catches it? If not, is the reason in `execution.md` sound?
<!-- /type -->
<!-- type: custom -->
- Does every change in code behavior have a test that catches it? If not, is the reason in the custom step's artifact sound?
<!-- /type -->
<!-- type: bugfix feature refactor general custom -->
- **Conventions:** the repo's conventions and readability. Read the instruction files that govern the changed code (such as `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md` at the repo root and in the folders above a changed file). Flag a broken convention only when you can quote the rule and the line that breaks it, and name the file of the rule. No style preferences.
- Fit with the existing structure: the layer or module each change sits in, dependency directions, the patterns the code around it follows.
- **Reuse:** Duplication: code that repeats a function or abstraction the repo already has. Search the shared modules and the files next to the change, and name the one to call instead.
- **Simplification:** complexity the diff adds without need: state that can be derived, copy-paste with small changes, deep nesting, dead code left behind. Name the simpler form that does the same job.
- **Efficiency:** wasted work the diff adds: repeated computation or I/O, independent work run one after another, blocking work added to startup or a hot path. Name the cheaper way.
- **Altitude:** does each change fix the root cause at the right depth, or patch a symptom? A special case added on top of shared code is a sign it is not deep enough: name the more general change to the underlying mechanism.
- Maintainability: complexity that grows (deep nesting, long functions, more flags), and tests tied to internal details that will break on any change.
- A rule in the team knowledge (`kind: rule`, in `context.md`) that the change breaks is a 차단 finding. For entries listed by title only, open the ones that touch the changed code to see whether they are rules.
- Changes that are not needed.
- **Out of scope:** a maintainability problem beyond this Work (it was there before, or fixing it would widen the diff) is not a finding. Write it in `나중에 정리할 곳` with why it is worth cleaning up. It is not picked or applied.
<!-- /type -->
<!-- type: bugfix -->
- Code that the reproduction steps use is not unused code.
<!-- /type -->

## Rules

<!-- type: bugfix feature refactor general custom -->
- **Code:** change code only for the findings the human picked. Commit those changes. Revert any other experimental change when you close.
<!-- /type -->
<!-- type: spec -->
- **Document:** change the target document only for the findings the human picked, and commit. Do not change code. Revert any experimental change when you close.
- **`다시 볼 결정`:** a decision with a better alternative or a missed risk goes in `다시 볼 결정`, not in `리뷰 지적`. It is not a finding to pick: the Work completion screen and `pr.md` only show it. To change it, the human tells you in the terminal before approving: then decide it like a new decision below.
- **A finding that needs a new decision:** ask the human on the spot, in the same shape as the spec step asks: options, the recommended one first with "(추천)", and the reason in its description. Change the document and its decision table by the answer, and mark it as the human's decision.
- **Verdicts on the document:** judge each 완료조건 by reading the document and the diff. Judge "대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다" from the diff against the base commit, and list every other changed file in `문서 밖 파일 변경`.
- **No test command:** the intent has none. Skip running tests.
<!-- /type -->
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
- **"안전망 테스트가 있고 기준 코드에서도 통과한다":** run the safety-net tests at the safety-net commit (hash in `refactor.md`; the base commit when no new test was needed), in the same worktree:
  1. `git checkout --detach <safety-net commit>`.
  2. For each test marked (추가) in `refactor.md` (added later, not in that commit): `git checkout <work branch> -- <test file>`.
  3. Run the safety-net tests at the paths listed for the safety-net commit.
  4. `git reset --hard`, then `git checkout <work branch>`. The work branch (`작업 브랜치`) is in `context.md`.

  Run them on the final code too, at their current paths (a moved test shows its new path in `refactor.md`). 통과 only if both pass. Check that every changed place has a safety net that really catches its behavior. Accepted differences are exceptions. If a place had no safety net (reason in `refactor.md`), it is 판정 불가. Before you close, confirm `git branch --show-current` is the work branch.
- **"레포 밖 공개 인터페이스가 바뀌지 않는다":** judge from the diff against the base commit whether anything used outside the repo changed (exports, HTTP API, CLI arguments, stored formats and schemas). Leave out what the intent says to change.
<!-- /type -->
<!-- type: custom -->
- **Re-run everything yourself** when you verify: each 완료조건's check method and the test commands. Use the results in the custom steps' artifacts only for comparison.
<!-- /type -->
<!-- type: general -->
- **Re-run everything yourself** when you verify: each 완료조건's check method and the test commands. Use the results in `execution.md` only for comparison.
<!-- /type -->
<!-- type: general custom -->
- **Check methods:** first run the method at the end of each 완료조건 line yourself. If it does not really check that 완료조건 (e.g. the command never runs that behavior), add your own check (read the code, run more), judge with both, write both in the evidence, and write in `남은 위험` that the check method fell short. Do not change the intent.
- **`확인: 사람` items:** judge them by asking the human (see Human decisions). Before you ask, check what you can yourself and show it.
<!-- /type -->
- **Verdicts:** 통과 / 실패 / 판정 불가. For 판정 불가, give the reason, and add useful facts if any.
<!-- type: bugfix -->
  For example, the reproduction test passes in a Work that never reproduced the bug. If the Work proceeded without reproduction, "재현 절차가 더 이상 실패하지 않는다" is 판정 불가. If there are neither reproduction steps nor a reproduction test, it is 판정 불가 too.
<!-- /type -->
<!-- type: bugfix feature refactor general custom -->
- **Changed test files:** list every test file changed since the base commit (`git diff <base commit>`), including ones the step's artifact does not mention. Mark each 약화 아님 or 약화 의심, with the reason.
<!-- /type -->
<!-- type: feature -->
  A change to a test of a behavior marked (바뀜) or (없앰) in the 완료조건 is 약화 아님 when its new expected values match that line: write "약화 아님 — (바뀜) n" or "약화 아님 — (없앰) n", with the marker of that line, and do not ask. n is the line's position among all 완료조건 lines of the intent, counting from 1 (default items included), as in `implement.md`. If the test of the old behavior was only deleted, with no test of the changed behavior or of the removal, it looks like weakening: ask. Judge any other change as above.
<!-- /type -->
<!-- type: refactor -->
  An existing test that only followed an internal interface change (call names, import paths, file location, setup code) is 약화 아님. If its expected values or inputs changed, or a test disappeared, it looks like weakening: ask.
<!-- /type -->
- **An earlier result is wrong:** if the change itself is wrong (e.g. it only hides the symptom), write it as a 차단 finding; if the human picks it, fix it here. If the intent, the cause or the design is wrong and the work must start over, ask the human: fix it here / start over as a new Work (see "When an earlier result is wrong" in the common rules). There is no going back to an earlier step.

## Decision points

- How to fix a picked finding, and the verdict of each 완료조건. With 결정마다 확인, ask before you change code and before you settle the verdicts.

## Human decisions

Ask on the spot:

- **Which findings to apply** (only when there are findings). In one question, list each finding in one line (number, severity, what). Offer: 차단·권장만 반영 / 모두 반영 / 반영하지 않음, and put the one you recommend first. The human can also type the numbers. Record what they picked and what they did not in `decisions` with `by: human`.
<!-- type: general custom -->
- **`확인: 사람` items:** gather them all into one question. For each, show what to look at (file, diff location, run result). The human's answer decides 통과 or 실패. Write "사람 확인" and the answer in the evidence, and record the answer in `decisions` with `by: human`.
<!-- /type -->
<!-- type: bugfix feature refactor general custom -->
- **A test change looks like weakening:** show which test changed and how. If the human says it is not weakening, the 완료조건 on weakening tests is 통과. If they say it is, it is 실패.
<!-- /type -->
- **Any 실패 or 판정 불가:** let the human choose:
  - Fix it here: fix and commit, run the test commands (if any), and judge again on the final code. Write what you did in `반영`.
  - Go to the completion screen as is. The screen shows a warning.
  - Start over as a new Work: write a Work draft and close as `blocked` (see the common rules).

## Done when

<!-- type: bugfix feature refactor general custom -->
- `verification.md` has all seven template sections.
- If there were findings, the human picked; the picked ones are fixed and committed, and the test result is in `반영`.
- Every 완료조건 of the intent has a verdict and evidence, judged on the final code.
- Every changed test file is judged.
<!-- /type -->
<!-- type: spec -->
- `verification.md` has all seven template sections.
- If there were findings, the human picked; the picked ones are applied to the document and committed.
- Every 완료조건 of the intent has a verdict and evidence, judged on the final document and the diff.
- `문서 밖 파일 변경` lists every changed file outside the target document and the knowledge files, and `다시 볼 결정` is written.
<!-- /type -->
- `pr.md` is written.
- Any weakening suspicion, 실패 or 판정 불가 was asked about, and the answer recorded in `decisions`.
<!-- type: general custom -->
- Every `확인: 사람` item was asked about, and the answer recorded in `decisions`.
<!-- /type -->

## Artifact template: `verification.md`

```markdown
## 리뷰 지적
1. [차단 / 권장 / 사소] 파일:줄 — 무엇이 문제인지와 제안
(지적이 없으면 "없음")

## 반영
<!-- type: bugfix -->
- 지적 번호 — 한 일, 커밋, 테스트 명령과 결과 (재현 절차를 바꿨으면 달라진 절차)
<!-- /type -->
<!-- type: feature refactor general custom -->
- 지적 번호 — 한 일, 커밋, 테스트 명령과 결과
<!-- /type -->
<!-- type: spec -->
- 지적 번호 — 문서에서 고친 곳, 커밋
<!-- /type -->
(사람이 고른 것이 없으면 "없음")

## 반영하지 않은 지적
- 지적 번호
(없으면 "없음")

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
<!-- type: bugfix feature refactor general custom -->
| (완료조건 그대로) | 통과 | 실행한 명령과 결과 |
<!-- /type -->
<!-- type: spec -->
| (완료조건 그대로) | 통과 | 읽은 곳(문서의 절, diff) |
<!-- /type -->

<!-- type: bugfix feature refactor general custom -->
## 테스트 파일 변경
- 파일 — 약화 아님 / 약화 의심(사람 판단: …) — 이유
(바뀐 테스트 파일이 없으면 "없음")

## 나중에 정리할 곳
- 파일·모듈 — 무엇이 문제인지, 정리하면 좋을 까닭
(없으면 "없음")
<!-- /type -->
<!-- type: spec -->
## 문서 밖 파일 변경
- 파일 — 무엇이 바뀌었는지
(대상 문서와 지식 파일 밖의 변경이 없으면 "없음")

## 다시 볼 결정
- 결정 — 더 나은 대안이나 놓친 위험
(없으면 "없음")
<!-- /type -->

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
- `동작`: what the user scenarios in `design.md` can now do. Split it into 새로 되는 것 / 바뀌는 것 / 없어지는 것, only those that apply. `호환성`: only when a 완료조건 is marked "(레포 밖 인터페이스)": what breaks for users outside the repo and how they move over; otherwise leave the section out. `주요 설계 결정`: the chosen way and rejected alternatives, briefly.

```markdown
# PR 제목

## 요약
## 동작
## 호환성
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
<!-- type: general custom -->
- `주요 결정`: the chosen way, rejected alternatives and what the human decided, briefly.

```markdown
# PR 제목

## 요약
## 주요 결정
## 변경
## 테스트
```
<!-- /type -->
<!-- type: spec -->
- `주요 결정`: what the human decided, with rejected alternatives, briefly. `다시 볼 결정`: copy from `verification.md`, or "없음". `정하지 않은 것`: or "없음". `구현 나눔`: only when it was decided; the pieces and their order. `변경`: which sections of the document were added or changed.

```markdown
# PR 제목

## 요약
## 주요 결정
## 다시 볼 결정
## 정하지 않은 것
## 구현 나눔
## 변경
```
<!-- /type -->
