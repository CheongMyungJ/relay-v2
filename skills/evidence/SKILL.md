---
description: relay evidence step. Reproduces the bug and records observed facts (evidence.md).
disable-model-invocation: true
---

# relay: evidence

Reproduce the bug and collect observed facts in `evidence.md` in the task directory. Judging the cause is the job of rca.

## Inputs

- The argument gives the path of `context.md`. Read it first.
- If you need the original request, read `request.md` at the path in `context.md`.

## Rules

- **This skill does not change code.** Revert experimental changes such as debug output when you close. Adding a reproduction test as code is the job of fix.
- **Observe only.** Record logs, inputs, actual and expected values, and the conditions under which the bug does and does not reproduce.
- **Human suspicions** in the intent's `추가 의견`: if you observe something related, record it as a fact. Do not judge whether the suspicion is true.
- **Your own hypotheses** go only in the handoff section `## 다음 task가 알아야 할 것`.

## Decision points

- How to reproduce (which commands and inputs). With 결정마다 확인, ask before you try to reproduce.

## Human decision: the bug does not reproduce

Ask on the spot with these options:

1. Get more information from the human and try again.
2. Proceed without reproduction, with the observed facts only.
3. Close as `blocked`.

Record the answer in `decisions`. Write the result and the human's choice in `재현 절차`.

## Done when

- `evidence.md` has all four template sections.
- The bug reproduced, or you asked the human about the failed reproduction and recorded the answer in `decisions`.
- Every observed fact has a source.

## Artifact template: `evidence.md`

```markdown
## 환경
- 브랜치, 커밋, OS, 런타임 버전 등 확인한 것

## 재현 절차
1. 그대로 실행할 수 있는 명령과 단계
- 결과: 재현됨 / 재현 안 됨 (재현 안 됨이면 사람의 선택)

## 기대와 실제
- 기대:
- 실제:

## 관찰 사실
- 사실 — 출처(파일:줄, 명령 출력, 로그)
```
