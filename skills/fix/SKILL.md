---
description: relay fix step. Fixes the code along the rca direction, commits, and summarizes the change (fix.md).
disable-model-invocation: true
---

# relay: fix

Fix the code along the fix direction in rca and commit. Write the change summary in `fix.md` in the task directory. This is the only step that changes code.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent (with `size`) and the Work's base commit.
- `rca.md`, and `evidence.md` if needed, at the paths in `context.md`.
- **S path** (`size: S`): there is no `evidence.md` or `rca.md`. Your only input is `context.md`.
- **Continuing on current code** (chosen when rewinding to fix): keep the existing commits and fix on top of them.

## S path

- Before fixing, confirm the bug reproduces and write the cause briefly. Put both in the section `원인과 재현` of `fix.md`. It replaces `rca와 달라진 점`.
- Judge each human suspicion in the intent's `추가 의견` in that section: 맞음 / 틀림 / 판단 불가, with the reason. If it is wrong, also add it to handoff `rejected`.
- If the bug does not reproduce, or you cannot narrow the cause to one place: write what you found in that section, set `recommended_next` to `evidence` or `rca` with the reason, and close. Do not change `size`.

## Rules

- **Reproduction test:** add one whenever you can. Confirm it fails before the fix and passes after. If you cannot add one (e.g. UI behavior, needs an external service), write why in `fix.md` and `risks`.
- **Commits:** any number. Follow the repo's commit message convention. Commit all changes before you close.
- **rca was wrong:** if you learn the cause in rca is wrong, write what you found in `rca와 달라진 점` and close with `recommended_next: {node: rca, reason}`. If the cause is the same and only the fix location differs, decide it yourself and record it in `decisions`.
- **Changing existing tests:** if an existing test must change, change it, add it to `risks`, and mark it as an existing-test change in `변경 요약`. Whether it weakens the test is judged by verify.
- **Run tests:** run the test command from the intent's 완료조건. For each failure, check whether it also fails at the base commit (from `context.md`), and say which.

## Decision points

- How to implement within the fix direction. With 결정마다 확인, ask before you change code.

## Done when

- `fix.md` has all four template sections.
- All changes are committed.
- The reproduction test fails before and passes after the fix, or you wrote why you could not add one.
- You ran the intent's test command and wrote the result.

## Artifact template: `fix.md`

```markdown
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

## rca와 달라진 점
없음
```

On the S path, write this section instead of `rca와 달라진 점`:

```markdown
## 원인과 재현
- 재현 절차: 그대로 실행할 수 있는 명령과 단계, 재현 여부
- 원인: 한두 문장
- 근거:
- 사람 추정 판정: (추정이 없으면 "없음")
```
