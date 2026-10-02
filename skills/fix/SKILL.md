---
description: relay fix step. Reproduces the bug, finds the root cause, fixes the code, commits, and writes it all up (fix.md).
disable-model-invocation: true
---

# relay: fix

Reproduce the bug, find the cause, fix the code and commit. Write what you found and changed in `fix.md` in the task directory. This is the step that changes code.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- If you need the original request, read `request.md` at the path in `context.md`.
- **Continuing on current code** (chosen when rewinding to fix): keep the existing commits and fix on top of them.

## Order

1. **Reproduce.** Run the bug with concrete commands and inputs. Record expected and actual values.
2. **Find the cause.** It must explain both the conditions where the bug reproduces and those where it does not. Test it by experiment when you can (e.g. change the code temporarily and see whether the bug goes away). If you could not, write that in `assumptions`.
3. **Ask if needed** (see Human decisions). Otherwise go on without asking.
4. **Fix** with a reproduction test, run the tests, and commit.

## Rules

- **Human suspicions** in the intent's `추가 의견`: judge each one as 맞음 / 틀림 / 판단 불가, with the reason. If it is wrong, also add it to handoff `rejected`.
- `기각한 가설` overlaps with handoff `rejected`. Give the reasoning in `fix.md` and one line each in the handoff.
- **Reproduction test:** add one whenever you can. Confirm it fails before the fix and passes after. If you cannot add one (e.g. UI behavior, needs an external service), write why in `fix.md` and `risks`.
- **Commits:** any number. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output.
- **Changing existing tests:** if an existing test must change, change it, add it to `risks`, and mark it as an existing-test change in `변경 요약`. Whether it weakens the test is judged by verify.
- **Run tests:** run the test command from the intent's 완료조건. For each failure, check whether it also fails at the base commit (from `context.md`), and say which.

## Knowledge

- `failure` items in `참고 지식` are hypothesis candidates: check the ones on these paths first.
- **Extract:** a `원인` whose symptom and cause are in different modules (`structure`), how to reproduce or a test that already fails at the base commit (`recipe`), a human decision on the fix direction (`domain`).

## Decision points

- How to reproduce, and how to implement the fix. With 결정마다 확인, ask before you try to reproduce and before you change code.

## Human decisions

Ask on the spot, before you change code:

- **The bug does not reproduce:** options are get more information from the human and try again / proceed without reproduction, with the observed facts only / close as `blocked`.
- **You cannot narrow the cause to one:** options are investigate more / proceed with the most likely candidate / close as `blocked`.
- **The cause is clear, but fix directions differ in behavior** (e.g. which rounding rule, what an edge case should return), and the intent does not settle it. Show the cause and the options.
- **A fix choice widens the scope, or touches the intent's non-goals or constraints.** Example: whether to also fix other paths that use the same function.

In any other case, decide the fix yourself and record it in `decisions`.

## Done when

- `fix.md` has all five template sections.
- The bug reproduced, or you asked the human about the failed reproduction and recorded the answer in `decisions`.
- The cause explains the reproduction conditions, or you asked the human about the unnarrowed cause and recorded the answer in `decisions`.
- Every human suspicion is judged.
- All changes are committed.
- The reproduction test fails before and passes after the fix, or you wrote why you could not add one.
- You ran the intent's test command and wrote the result.

## Artifact template: `fix.md`

```markdown
## 재현
- 재현 절차: 그대로 실행할 수 있는 명령과 단계
- 결과: 재현됨 / 재현 안 됨 (재현 안 됨이면 사람의 선택)
- 기대:
- 실제:

## 원인
- 원인: 한두 문장
- 근거: 관찰 사실과 출처(파일:줄, 명령 출력), 실험 결과 (못 했으면 "실험 안 함"과 이유)
- 사람 추정 판정: 추정 — 맞음 / 틀림 / 판단 불가 — 근거 (추정이 없으면 "없음")
- 기각한 가설: 가설 — 기각 근거 (없으면 "없음")

## 변경 요약
- 파일 — 무엇을 왜 바꿨는지
- (기존 테스트 변경) 파일 — 무엇을 왜 바꿨는지

## 재현 테스트
- 위치:
- 수정 전: 실패 (명령과 결과)
- 수정 후: 통과 (명령과 결과)
- 추가하지 못했으면 이유

## 테스트 실행
- 명령:
- 결과:
- 실패 항목: 기준 커밋에서도 실패 / 이번 수정 뒤 실패
```
