---
description: relay intake step. Turns the Work request into an intent draft (intent.draft.md).
disable-model-invocation: true
---

# relay: work-start (intake)

Read the request, talk with the human, and write the intent draft `intent.draft.md` in the task directory. The human confirms it on the intent approval screen. That approval is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. For intake it contains the request text (`request.md`) in full, and the Work type (`업무 유형`) the human picked: `bugfix` (버그 수정) or `feature` (기능 추가).
- **Rewound to intake:** `context.md` also has the current approved intent and the human's extra instructions. Start from the current intent and revise it to fit the instructions. Do not rewrite from scratch.

## Rules

- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not reproduce the bug or trace the cause. That is the job of fix. For a feature, do not design it either. That is the job of design.
- Do not write the cause, how to fix it, or how to build the feature in the intent. The only exceptions are the human's suspicions and suggestions below.
- **Human suspicions:** if the request says where the human suspects the bug is, copy it to `추가 의견` with the prefix "(사람 추정, 확인 안 됨)".
- **Human suggestions (feature):** if the request says how to build it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". design decides whether to take it.
- **Type mismatch:** the human picked the type. If it does not fit the request (e.g. `feature`, but the request says current behavior is wrong), ask before you write the draft. If the human wants to change the type, close as `blocked` and tell them to pick the type with [단계 선택] → intake. If they keep it, draft with the picked type. Never change the type yourself.
- **Your own hypotheses** do not go in the intent. Put them only in the handoff section `## 다음 task가 알아야 할 것`, as reference.
- Keep the intent around 1,500 characters. It goes into every task.

## Decision points

Scope (`비목표`) and completion criteria (`완료조건`). This skill has no human decisions.

- 초안 우선: ask only what you cannot draft without, such as the expected behavior.
- 결정마다 확인: ask about both decision points before writing the draft.
- If the human answers "모름" to something you cannot draft without, draft the most plausible value and keep that item in `open_questions`. The human sees it on the approval screen.

## 완료조건 section

- Always start with three items, by type. Find the concrete test command in the repo (e.g. `npm test`). Leave out only the test command item if the repo has no tests.
  - `bugfix`: `- [ ] 재현 절차가 더 이상 실패하지 않는다` / `- [ ] <test command>가 통과한다` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다`
  - `feature`: `- [ ] <test command>가 통과한다` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다` / `- [ ] 완료조건의 각 동작을 확인하는 테스트가 있다`
- Then add items that fit the request. For a feature, these are the acceptance criteria: one behavior seen from outside per line, as "<조건>이면 <결과>" (e.g. "빈 검색어로 요청하면 400과 오류 문구를 돌려준다"). No implementation details (which function to add etc.).
- One verifiable sentence per line. Never include push or PR. They happen after verify, so verify cannot judge them.

## Done when

- `intent.draft.md` has all required sections: `목표`, `비목표`, `원하는 결과`, `완료조건`.
- Every 완료조건 line is a verifiable sentence.
- Items you could not draft without were asked, or left in `open_questions`.

## Artifact template: `intent.draft.md`

No front matter: the app adds the type and version when the human approves.

```markdown
## 목표

## 비목표
- (없으면 "없음")

## 원하는 결과

## 완료조건
- [ ] (유형별 기본 항목 세 개)
- [ ] …
- [ ] (요청에 맞는 항목. 기능 추가는 "<조건>이면 <결과>")

## 제약
- (선택)

## 추가 의견
- (선택) (사람 추정, 확인 안 됨) … / (사람 제안) …
```
