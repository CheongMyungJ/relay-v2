---
description: relay implement step (feature). Writes tests first and implements the plan in design.md, commits, and writes it up (implement.md).
disable-model-invocation: true
---

# relay: implement (구현)

For a feature Work, follow the implementation plan in `design.md`: write the tests first, change the code and commit. Write what you did in `implement.md` in the task directory. This is the step that changes code.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- `design.md` at the path in `context.md`: the requirements, the approach, the implementation plan and the test plan.
- **Continuing on current code** (chosen when rewinding to implement or design): keep the existing commits and change on top of them.

## Order

For each step of the plan:

1. Write the tests for the 완료조건 the step covers.
2. Run them and confirm they fail before the change.
3. Implement.
4. Confirm they pass.
5. Commit.

When all steps are done, run the intent's test command.

## Rules

- **New behavior tests:** a test that passes from the start does not catch the new behavior. Fix it. Exception: when a 완료조건 asks to keep the current behavior (e.g. "without the option, it works as now"), its test may pass before the change. Record its before as "통과(지금 동작을 지킴)". If a behavior cannot get a test (e.g. UI behavior, needs an external service), write why in `implement.md` and `risks`. Record before and after for each test in `새 동작 테스트`.
- **Commits:** any number. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output.
- **Changing existing tests:** if an existing test must change, change it, add it to `risks`, and mark it as an existing-test change in `변경 요약`. Whether it weakens the test is judged by verify.
- **Run tests:** run the test command from the intent's 완료조건. For each failure, check whether it also fails at the base commit (from `context.md`), and say which.
- **Small departures from the plan** (how files are split, names, the order of steps, small helper functions): decide yourself and write them in `계획과 달라진 점`.
- **The design is wrong:** set `recommended_next` to `design` with the reason. The app stops and the human picks the step.

## Knowledge

- `constraint` items in `참고 지식` apply to the paths in `바뀌는 곳`.
- **Extract:** a `계획과 달라진 점` that reveals a rule (`constraint`) or a relation across modules (`structure`).

## Decision points

- Implementation details the plan does not settle. With 결정마다 확인, ask before you change code.

## Human decisions

Ask on the spot, before you change code, only when the implementation departs far from `design.md`. Far means one of:

- What is seen from outside (behavior or interface) differs from the design.
- The scope widens, or the change touches the intent's non-goals or constraints.
- You go a different way from `접근` (e.g. another library, another way to store data).
- You add a dependency the design does not have, or change a data format or schema.

## Done when

- `implement.md` has all four template sections.
- Every step of the plan is done, or the difference is in `계획과 달라진 점`.
- Each behavior in the intent's 완료조건 has a test that failed before (or passed before, for a 완료조건 that keeps the current behavior) and passed after, or you wrote why it could not.
- Far departures were asked and the answers recorded in `decisions`.
- All changes are committed.
- You ran the intent's test command and wrote the result.

## Artifact template: `implement.md`

```markdown
## 변경 요약
- 계획 단계 n — 파일 — 무엇을 바꿨는지, 커밋
- (기존 테스트 변경) 파일 — 무엇을 왜 바꿨는지

## 계획과 달라진 점
- 무엇이 왜 달라졌는지 (사람이 정했으면 표시)
(없으면 "없음")

## 새 동작 테스트
| 완료조건 | 테스트 위치 | 구현 전 | 구현 후 |
|---|---|---|---|
(테스트를 더하지 못한 동작은 이유)

## 테스트 실행
- 명령:
- 결과:
- 실패 항목: 기준 커밋에서도 실패 / 이번 변경 뒤 실패
```
