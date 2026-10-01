---
description: relay design step (feature). Writes the user scenarios, requirements, approach and implementation plan of a feature (design.md). Does not change code.
disable-model-invocation: true
---

# relay: design (설계와 계획)

For a feature Work, write what to build (user scenarios, requirements) and how to build it (approach, what changes, implementation plan, test plan) in one file, `design.md` in the task directory. Small features go through this step too: keep each section to a line or two.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit.
- If you need the original request, read `request.md` at the path in `context.md`.
- **Continuing on current code** (chosen when rewinding to design): read the current code (the earlier implementation) and revise `design.md`. Leave the code as it is.

## Order

1. User scenarios.
2. Requirements.
3. Ask if needed (see Human decisions).
4. Approach and what changes.
5. Implementation plan and test plan.

## Rules

- **This skill does not change code.** Read the code only as far as the design needs. Revert any experiment when you close.
- **User scenarios:** who does what, for what, and how, in a few steps. One scenario for a small feature. For an internal feature with no user, the calling code or the developer is "who".
- **Functional requirements** (F1, F2…): make the intent's 완료조건 concrete, and give each its source (완료조건 n / 설계에서 더함). Adding a requirement the intent does not have widens the scope: ask the human. Requirements are for reference: verify judges only the intent's 완료조건.
- **Non-functional requirements** (N1, N2…): go through performance, compatibility and migration, security, error handling, accessibility. Write only those that apply, each with how to check it. If none, write "없음".
- **Human suggestions:** for each "(사람 제안)" in the intent's `추가 의견`, write in `접근` whether you take it and why.
- **Implementation plan:** for each step, what changes and which requirements it covers. implement writes the tests first for each step, so make each step small enough to test.
- **Test plan:** for each requirement, where and how it is tested. Each behavior in the intent's 완료조건 must be covered by at least one test. If a behavior cannot get a test (e.g. UI behavior, needs an external service), write why.
- **Conflict with the intent:** if 완료조건 contradict each other or cannot be met, write it in `intent_deviation`. If the intent must change, set `recommended_next` to `intake`.

## Decision points

- The approach, what changes, and how to split the plan. With 결정마다 확인, ask before you decide them.

## Human decisions

Ask on the spot. In any other case, decide yourself and record it in `decisions`.

- **Several options change what is seen from outside** (behavior or interface) and the intent does not settle it. Example: whether an error throws or returns an empty result.
- **The design widens the scope, or touches the intent's non-goals or constraints**, including adding a requirement the intent does not have.
- **You do not take a human suggestion.**

## Done when

- `design.md` has all seven template sections.
- Every functional requirement has a source and is in a step of the implementation plan.
- Each behavior in the intent's 완료조건 has a test in the test plan, or a reason why it cannot.
- The human decisions were asked and the answers recorded in `decisions`.
- No code changed (experiments reverted).

## Artifact template: `design.md`

```markdown
## 유저 시나리오
1. <누가> <무엇을 하려고> — 쓰는 흐름 몇 단계

## 요구사항
### 기능
- F1. <조건>이면 <결과> — 출처: 완료조건 n / 설계에서 더함(사람이 정함)
### 비기능
- N1. 관점 — 요구 — 확인 방법
(해당 없으면 "없음")

## 접근
- 방식:
- 고려한 대안: 대안 — 기각 이유 (없으면 "없음")
- 사람 제안 판정: 제안 — 받아들임 / 받아들이지 않음(사람이 정함) — 이유 (없으면 "없음")

## 바뀌는 곳
- 파일·모듈 — 무엇이 바뀌는지 (새 인터페이스, 데이터 형식, 설정)

## 구현 계획
1. 단계 — 바꿀 것 — 덮는 요구사항(F1, N1)

## 테스트 계획
| 요구사항 | 테스트 위치와 방식 |
|---|---|

## 위험
- 
```
