---
description: relay refactor step (refactoring). Plans the target structure, commits safety-net tests first, changes structure step by step without changing behavior, and writes it up (refactor.md).
disable-model-invocation: true
---

# relay: refactor (계획과 리팩터링)

For a refactoring Work, change the structure without changing behavior. In one session: plan the target structure, commit safety-net tests that pin the current behavior, then change the structure one plan step at a time, committing each step. Write what you did in `refactor.md` in the task directory. This is the step that changes code.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit. If you need the request text, read `request.md` at the path in `context.md`.
- **Continuing on current code** (chosen when rewinding to refactor): keep the existing commits and change on top of them. Do not make the safety-net commit again: copy the `안전망 커밋` hash from the discarded `refactor.md` (path in `context.md`). If you need more safety-net tests, commit them separately before you change structure further, mark them (추가) in the table, and get their base-code result with the procedure below.

## Order

1. **Plan.** Write the target structure in a few lines and the steps. For each step, what changes and which 완료조건 it covers. Make each step small enough that the tests pass after committing it alone.
2. **Ask if needed** (see Human decisions).
3. **Safety net.** For each place you will change, decide the tests that pin its current behavior. Commit only the safety net, as one commit, before any structural change.
4. **Steps.** For each plan step: change structure, run the test command, commit.
5. Run the intent's test command at the end.

## Rules

- **Do not change behavior.** If you find a bug (current behavior is wrong) while changing code, do not fix it. Keep the current behavior, and write the bug in `찾은 버그와 받아들인 차이` and in `risks`. A bug fix is a separate bugfix Work.
- **Safety net:** if existing tests already cover a behavior, list that test as the safety net with the reason it covers it. Write new tests only for behavior no test covers. If the repo has a coverage tool, use it to check. A new safety-net test must pass on the base code. If it fails, you wrote the current behavior wrong: fix the test (if the current behavior is a bug, see above). Write the safety-net commit hash on the first line of `안전망 테스트`. If existing tests cover everything and you wrote no new test, write the base commit (from `context.md`) there with "(새 테스트 없음)".
- **Test paths:** in the table, write each test's path at the safety-net commit. If you move a test file later, add its new path ("→ 새 경로"), so that verify runs the right file at each commit.
- **Base-code result of an extra (추가) test:** `git checkout --detach <safety-net commit>`, `git checkout <work branch> -- <test file>`, run it, then `git reset --hard` and `git checkout <work branch>`. The work branch (`작업 브랜치`) is in `context.md`. An extra test must use only interfaces that exist at the safety-net commit.
- **No safety net possible** (UI behavior, needs an external service, no way to run tests): do not ask. Write why in `안전망 테스트` and in `risks`, and go on. verify marks that part 판정 불가.
- **Interfaces:** you may change names, signatures and module boundaries used only inside the repo, and fix the callers in the repo together. Existing tests may follow such a change only in call names, import paths, file location and setup code. Never change their expected values or inputs. Change an interface used outside the repo (what a library exports, HTTP API, CLI arguments, stored formats and schemas) only when the intent says so.
- **Commits:** one safety-net commit, then one commit per plan step. The test command must pass at every commit. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output.
- **Run tests:** run the test command from the intent's 완료조건. For each failure, check whether it also fails at the base commit (from `context.md`), and say which.
- **Intent conflict:** if 완료조건 conflict or cannot be met, write it in `intent_deviation`. If the intent must change, set `recommended_next` to `intake`.

## Decision points

- The target structure, how to split the plan, which safety-net tests to write. With 결정마다 확인, ask before you settle the plan.

## Human decisions

Ask on the spot only in these cases. In any other case, decide yourself and record it in `decisions`.

- Several target structures are possible and the intent does not settle it.
- What you change widens the scope, or touches the intent's non-goals or constraints. This includes changing an interface used outside the repo.
- You do not take a human suggestion ("(사람 제안)" in `추가 의견`).
- Changing the structure must change behavior a little (error text, logs, an order that was never defined). Show what changes and how, and offer: keep the current behavior another way / accept the difference / drop that part from scope. If accepted, change only that expected value in the safety-net test, and record it in `decisions` with `by: human` and in `찾은 버그와 받아들인 차이`.

## Done when

- `refactor.md` has all five template sections.
- Every changed place has a safety net (existing or new). New safety-net tests passed on the base code and were committed separately before any structural change. Places without one have a reason.
- Every plan step is committed, and the test command passed at each commit.
- Bugs you found are written down, not fixed.
- Human decisions were asked and the answers recorded in `decisions`.
- You ran the intent's test command and wrote the result.

## Artifact template: `refactor.md`

```markdown
## 계획
- 목표 구조: (바꿀 모양을 몇 줄로)
- 고려한 대안: 대안 — 기각 이유 (없으면 "없음")
- 사람 제안 판정: 제안 — 받아들임 / 받아들이지 않음(사람이 정함) — 이유 (없으면 "없음")
- 단계: n. 바꿀 것 — 덮는 완료조건

## 안전망 테스트
- 안전망 커밋: <해시> (새 테스트가 없으면 기준 커밋 해시와 "(새 테스트 없음)")
| 바꾸는 곳 | 테스트 위치(안전망 커밋 때 경로, 옮겼으면 "→ 새 경로") — 기존 / 새로 / 추가 | 잡는 동작 | 기준 코드 |
|---|---|---|---|
(쓸 수 없는 곳은 이유)

## 변경 요약
- 단계 n — 파일 — 무엇을 바꿨는지, 커밋
- (기존 테스트 따라 고침) 파일 — 무엇을

## 찾은 버그와 받아들인 차이
- (찾은 버그) 위치 — 내용 — 고치지 않음
- (받아들인 차이) 무엇이 어떻게 — 사람이 정함
(없으면 "없음")

## 테스트 실행
- 명령:
- 결과: (커밋마다)
- 실패 항목: 기준 커밋에서도 실패 / 이번 변경 뒤 실패
```
