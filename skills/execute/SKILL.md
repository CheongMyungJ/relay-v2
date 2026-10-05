---
description: relay execute step (general Work). Plans and does the work the intent asks for, in whatever way fits, checks each completion criterion with its check method, and writes it up (execution.md).
disable-model-invocation: true
---

# relay: execute (실행)

For a general Work, do the work the intent asks for. How you do it is up to you: in one session, plan, do the work, commit, and run each 완료조건's check method yourself. Write what you did in `execution.md` in the task directory. This is the step that changes code.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit. If you need the request text, read `request.md` at the path in `context.md`.
- **Continuing on current code** (chosen when rewinding to execute): keep the existing commits and continue on top of them. Read the discarded `execution.md` (path in `context.md`) and write a new `execution.md`.

## Order

1. **Plan.** Write in a few lines what you will do and how, and the alternatives you considered. Size the plan to the work.
2. **Ask if needed** (see Human decisions).
3. **Do the work and commit.**
4. **Self-check.** For each 완료조건, run its check method (`— 확인: …` at the end of the line) and write the result.
5. Run the intent's test command at the end.

## Rules

- **How to work** is yours to decide: what to do first and how to split it. Write it in `계획` and in `decisions`.
- **Tests:** if you change how code behaves, add a test that catches that behavior. Write it before or after the change, as you like. If you cannot add one (UI behavior, needs an external service, no way to run tests), write why in `변경 요약` and in `risks`, and go on. Never weaken or delete existing tests.
- **Self-check:** run each 완료조건's check method for real and write the result in the `완료조건별 자체 확인` table. For `확인: 사람`, write where the human should look. verify runs them again, so this table is for comparison.
- **Commits:** any number. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output.
- **Run tests:** run the test command from the intent's 완료조건. For each failure, check whether it also fails at the base commit (from `context.md`), and say which.
- **Problems outside the scope:** do not fix them. Write them in `risks`. Fixing one widens the scope, which is a human decision.
- **Intent conflict:** if 완료조건 conflict or cannot be met, write it in `intent_deviation`. If the intent must change, set `recommended_next` to `intake`.

## Decision points

- How to do the work, how to split it, which tests to add. With 결정마다 확인, ask before you settle the plan.

## Human decisions

Ask on the spot only in these cases. In any other case, decide yourself and record it in `decisions`.

- Several options change what is seen from outside (behavior or interface), and the intent does not settle it.
- What you do widens the scope, or touches the intent's non-goals or constraints.
- You do not take a human suggestion ("(사람 제안)" in `추가 의견`).

## Done when

- `execution.md` has all four template sections.
- Every 완료조건 has the result of running its check method (where to look, for `확인: 사람`).
- Every change in code behavior has a test, or the reason it has none.
- Every change is committed.
- Human decisions were asked and the answers recorded in `decisions`.
- You ran the intent's test command and wrote the result.

## Artifact template: `execution.md`

```markdown
## 계획
- 할 일: (무엇을 어떻게, 몇 줄로)
- 고려한 대안: 대안 — 기각 이유 (없으면 "없음")
- 사람 제안 판정: 제안 — 받아들임 / 받아들이지 않음(사람이 정함) — 이유 (없으면 "없음")

## 변경 요약
- 파일 — 무엇을 바꿨는지, 커밋
- (테스트 못 더함) 바꾼 동작 — 이유

## 완료조건별 자체 확인
| 완료조건 | 한 일 | 확인 결과 |
|---|---|---|
| `npm test`가 통과한다 | — | `npm test` 실행, 통과 |

## 테스트 실행
- 명령:
- 결과:
- 실패 항목: 기준 커밋에서도 실패 / 이번 변경 뒤 실패
```
