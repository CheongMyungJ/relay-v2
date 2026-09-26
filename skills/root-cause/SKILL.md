---
description: relay rca step. Finds the root cause from the evidence and backs it with proof (rca.md).
disable-model-invocation: true
---

# relay: root-cause (rca)

Find the cause from the observed facts of evidence, and write it with its proof in `rca.md` in the task directory.

## Inputs

- The argument gives the path of `context.md`. Read it first.
- `evidence.md`, at the path in `context.md`.

## Rules

- **This skill does not change code.** Revert code you changed temporarily to test the cause when you close.
- **When a cause is confirmed:** it must explain both the conditions where the bug reproduces and those where it does not. Test it by experiment when you can (e.g. change the code temporarily and see whether the bug goes away). If you could not, write that in `assumptions`.
- **Human suspicions** in the intent's `추가 의견`: always judge each one as 맞음 / 틀림 / 판단 불가, with the reason. If it is wrong, also add it to handoff `rejected`.
- `기각한 가설` overlaps with handoff `rejected`. Give the full reasoning in `rca.md` and one line each in the handoff.

## Decision points

- Which cause, and the fix direction. With 결정마다 확인, ask before you settle them.

## Human decisions

Ask on the spot:

- **You cannot narrow the cause to one:** options are more investigation / proceed with the most likely candidate / close as `blocked`.
- **A fix choice widens the scope, or touches the intent's non-goals or constraints.** Example: whether to also fix other paths that use the same function. You decide any other fix direction yourself.

## Done when

- `rca.md` has all five template sections.
- The cause explains the reproduction conditions, or you asked the human about the unnarrowed cause and recorded the answer in `decisions`.
- Every human suspicion is judged.

## Artifact template: `rca.md`

```markdown
## 원인
한두 문장

## 근거
- evidence의 관찰 사실과의 연결
- 실험을 했으면 그 결과 (못 했으면 "실험 안 함"과 이유)

## 사람 추정 판정
- 추정 — 맞음 / 틀림 / 판단 불가 — 근거 (추정이 없으면 "없음")

## 기각한 가설
- 가설 — 기각 근거

## 수정 방향
- 수정 지점: 파일:함수
- 방향:
- 영향 범위:
```
