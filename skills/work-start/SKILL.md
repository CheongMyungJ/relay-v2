---
description: relay intake step. Turns the Work request into an intent draft (intent.draft.md).
disable-model-invocation: true
---

# relay: work-start (intake)

Read the request, talk with the human, and write the intent draft `intent.draft.md` in the task directory. The human confirms it on the intent approval screen. That approval is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. For intake it contains the request text (`request.md`) in full.
- **Rewound to intake:** `context.md` also has the current approved intent and the human's extra instructions. Start from the current intent and revise it to fit the instructions. Do not rewrite from scratch.

## Rules

- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not reproduce the bug or trace the cause. That is the job of evidence and rca.
- Do not write the cause or how to fix it in the intent. The only exception is the human's suspicions below.
- **Human suspicions:** if the request says where the human suspects the bug is, copy it to `추가 의견` with the prefix "(사람 추정, 확인 안 됨)".
- **Your own hypotheses** do not go in the intent. Put them only in the handoff section `## 다음 task가 알아야 할 것`, as reference.
- Keep the intent around 1,500 characters. It goes into every task.

## Decision points

Scope (`비목표`), completion criteria (`완료조건`), size (`size`). This skill has no human decisions.

- 초안 우선: ask only what you cannot draft without, such as the expected behavior.
- 결정마다 확인: ask about the three decision points before writing the draft.
- If the human answers "모름" to something you cannot draft without, draft the most plausible value and keep that item in `open_questions`. The human sees it on the approval screen.

## 완료조건 section

- Always start with these three items:
  - `- [ ] 재현 절차가 더 이상 실패하지 않는다`
  - `- [ ] <test command>가 통과한다`. Find the concrete test command in the repo (e.g. `npm test`). Leave out only this item if the repo has no tests.
  - `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다`
- Then add items that fit the request.
- One verifiable sentence per line. Never include push or PR. They happen after verify, so verify cannot judge them.

## Size

Propose `size` in the draft. Put the rationale in handoff `decisions` (`by: ai`), not in the intent.

Propose `S` only when all of these hold. Otherwise propose `M`. (`L` is treated like `M`.)

- The request contains a way to reproduce the bug.
- The request, or a skim of the code, narrows the fix location to one place.
- Nothing could touch the non-goals or constraints.

## Done when

- `intent.draft.md` has all required sections: `목표`, `비목표`, `원하는 결과`, `완료조건`.
- Every 완료조건 line is a verifiable sentence.
- `size` is proposed.
- Items you could not draft without were asked, or left in `open_questions`.

## Artifact template: `intent.draft.md`

```markdown
---
type: bugfix   # bugfix only
size:          # S | M | L. S only under the criteria above
---
## 목표

## 비목표
- (없으면 "없음")

## 원하는 결과

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다
- [ ] `<테스트 명령>`이 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다

## 제약
- (선택)

## 추가 의견
- (선택) (사람 추정, 확인 안 됨) …
```
