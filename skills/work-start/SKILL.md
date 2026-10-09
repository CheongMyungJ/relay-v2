---
description: relay intake step. Turns the Work request into an intent draft (intent.draft.md).
disable-model-invocation: true
---

# relay: work-start (intake)

Read the request, talk with the human, and write the intent draft `intent.draft.md` in the task directory. The human confirms it on the intent approval screen. That approval is always manual.

## Inputs

- The argument gives the path of `context.md`. Read it first. For intake it contains the request text (`request.md`) in full, and the Work type (`업무 유형`) the human picked.
- **Rewound to intake:** `context.md` also has the current approved intent and the human's extra instructions. Start from the current intent and revise it to fit the instructions. Do not rewrite from scratch.

## Rules

<!-- type: bugfix -->
- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not reproduce the bug or trace the cause. That is the job of fix.
- Do not write the cause or how to fix it in the intent. The only exception is the human's suspicions below.
- **Human suspicions:** if the request says where the human suspects the bug is, copy it to `추가 의견` with the prefix "(사람 추정, 확인 안 됨)".
<!-- /type -->
<!-- type: feature -->
- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not design the feature. That is the job of design.
- Do not write how to build the feature in the intent. The only exception is the human's suggestions below.
- **Human suggestions:** if the request says how to build it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". design decides whether to take it.
<!-- /type -->
<!-- type: refactor -->
- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not plan how to reach the structure. That is the job of refactor.
- Do not write the order or method of the change in the intent. The only exception is the human's suggestions below.
- **Human suggestions:** if the request says how to change it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". refactor decides whether to take it.
- **Behavior changes and performance goals:** a refactoring does not change behavior. If the request mixes in a behavior change (a feature or a bug fix) or a performance goal (e.g. "두 배 빠르게"), point it out and ask before you write the draft: drop that part to `비목표` and only refactor / change the type (`blocked`). If dropped, write what was dropped in `비목표`.
- **Interfaces used outside the repo** (what a library exports, HTTP API, CLI arguments, stored formats): if the request wants to change one, write what changes in the intent.
- **Vague goals:** if the structural goal is vague ("읽기 쉽게"), ask for a structure that can be checked.
<!-- /type -->
<!-- type: general -->
- **This skill does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not plan how to do the work. That is the job of execute.
- Do not write how to do the work in the intent. The only exception is the human's suggestions below.
- **Human suggestions:** if the request says how to do it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". execute decides whether to take it.
- **A better-fitting type:** `general` is for work that fits none of the other types. If the request fits `bugfix`, `feature` or `refactor` better, say which and why before you write the draft, and ask: keep `general` / change the type (`blocked`). If they keep it, draft with `general`.
- **Vague goals:** if the goal is vague ("정리해 줘"), ask for a result that can be checked.
<!-- /type -->
<!-- type: spec -->
- **This skill does not change code.** Skim the code and documents only enough to write concrete goals and completion criteria. Do not settle the design decisions. That is the job of spec.
- Do not write how to decide in the intent. The only exception is the human's suggestions below.
- **Human suggestions:** if the request says how something should be decided, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". spec still asks about it.
- **A small request:** `spec` is for big work whose design is settled before it is built. If the request is small enough that `feature` fits better, say why before you write the draft, and ask: keep `spec` / change the type (`blocked`). If they keep it, draft with `spec`.
- **Target document:** settle with the human which design document this goes into, a new one or an existing one, and write it in `제약` as "설계 문서: `<path>` (새 문서 / 기존 문서)". For a new document, if the repo has no convention for design documents, propose `docs/design/<english-name>.md`. The target document is not a document to follow: do not also write "의 결정을 따른다" for it.
<!-- /type -->
<!-- type: requirements -->
- **This skill does not change code and does not analyze the firmware.** Skim the repository only enough to write the scope. Do not trace behavior or list requirements. That is the job of extract, which the app runs as many small runs.
- **Do not ask the human to pick boards or features first.** "Every build configuration and the project's own code" is a valid scope. Settle only what to exclude and what material exists (datasheets, schematics and their versions, a toolchain the analysis may use).
- **Build:** ask whether the analysis may run the repository's build commands, and which toolchain (name and version) is installed. This is information you cannot draft without, not a human decision. Write it in `제약` as "빌드: 허용 (툴체인 …)" or "빌드: 허용하지 않음 (까닭)". It is a record for people and runs: the app still shows the real commands after the survey and asks again before it builds.
- **Boundaries:** vendor HAL, RTOS kernels and third-party libraries are boundaries by default: their configuration and call boundary are in scope, their internals are not. If the human wants one traced inside, write it in `제약` as "경계: …". If context.md lists submodules, write "서브모듈 안은 경계" in `제약`: they are not checked out.
- Write the scope and exclusions in `목표` and `비목표`, and the material, build and boundary lines in `제약`.
- **The result document is `extraction.md`.** The app writes it from the records at the end of extract, in the extract task folder. Do not pick a path in the repository for it, and write completion criteria about `extraction.md`.
<!-- /type -->
- **Type mismatch:** the human picked the type: `bugfix` (버그 수정: current behavior is wrong), `feature` (기능 추가: new behavior), `refactor` (리팩터링: change structure, keep behavior), `spec` (설계: settle only the design of big work before building it), `requirements` (요구사항 추출: recover the current behavior of existing firmware as requirement candidates and constraints with evidence) or `general` (일반: work that fits none of these, e.g. config, CI, docs, dependency upgrades, mixed work). If it does not fit the request (e.g. `feature`, but the request says current behavior is wrong), ask before you write the draft. If the human wants to change the type, close as `blocked` and tell them to pick the type with [단계 선택] → intake. If they keep it, draft with the picked type. Never change the type yourself.
- **A design document to follow:** if the request points to a design document in the repo, write "`<path>`의 결정을 따른다" in `제약`, and write the part this Work takes on as goals and completion criteria. If that document is not in the worktree (its design PR is not merged yet), tell the human before you write the draft and ask: wait for the merge (`blocked`) / go on from the request alone, without the document.
- **Your own hypotheses** do not go in the intent. Put them only in the handoff section `## 다음 task가 알아야 할 것`, as reference.
- Keep the intent around 1,500 characters. It goes into every task.

## Decision points

Scope (`비목표`) and completion criteria (`완료조건`). This skill has no human decisions.

- 초안 우선: ask only what you cannot draft without, such as the expected behavior.
- 결정마다 확인: ask about both decision points before writing the draft.
- If the human answers "모름" to something you cannot draft without, draft the most plausible value and keep that item in `open_questions`. The human sees it on the approval screen.

## 완료조건 section

<!-- type: bugfix feature refactor general -->
- Always start with these default items. Find the concrete test command in the repo (e.g. `npm test`). If the repo has no tests, leave out the test command item.
<!-- /type -->
<!-- type: bugfix -->
  `- [ ] 재현 절차가 더 이상 실패하지 않는다` / `- [ ] <test command>가 통과한다` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다`
- Then add items that fit the request.
<!-- /type -->
<!-- type: feature -->
  `- [ ] <test command>가 통과한다` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다` / `- [ ] 완료조건의 각 동작을 확인하는 테스트가 있다`
- Then add the acceptance criteria: one behavior seen from outside per line, as "<조건>이면 <결과>" (e.g. "빈 검색어로 요청하면 400과 오류 문구를 돌려준다"). No implementation details (which function to add etc.).
<!-- /type -->
<!-- type: refactor -->
  `- [ ] <test command>가 통과한다` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다` / `- [ ] 바꾼 곳의 지금 동작을 잡는 안전망 테스트가 있고 기준 코드에서도 통과한다` / `- [ ] 레포 밖 공개 인터페이스가 바뀌지 않는다` (leave out the interfaces the intent says to change)
- Then add the structural conditions that can be checked by reading code or running a command, one per line (e.g. "가격 계산은 `pricing` 모듈 한 곳에만 있다", "`routes/`는 `db/`를 직접 import하지 않는다"). Not the order or method of the change.
<!-- /type -->
<!-- type: general -->
  `- [ ] <test command>가 통과한다 — 확인: <test command>` / `- [ ] 기존 테스트를 약화하거나 삭제하지 않는다 — 확인: 기준 커밋과 테스트 파일 diff`
- Then add the items that fit the request, one per line. Not how to do the work.
- **Check method:** end every line, the default items included, with ` — 확인: <방법>`: a command to run, a place to read (a file or a code location), or `사람`. Use `사람` only when no command and no place to read can check it. The app rejects a line without a check method.
<!-- /type -->
<!-- type: spec -->
- Always start with these default items. No test command item: only the document changes.
  `- [ ] 대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다` / `- [ ] 문서의 서술이 서로, 그리고 지금 코드와 어긋나지 않는다` / `- [ ] 정하지 않고 남긴 것은 문서의 따로 둔 절에 이유와 함께 있다`
- Then add what the design must decide, as "<무엇>을 정한다", one per line (e.g. "PR 머지 조건을 정한다"). Not how to decide it. Agree on this list with the human: it is the scope of this Work.
- No check method (` — 확인: …`) on any line: verify judges them by reading the document and the diff.
<!-- /type -->
<!-- type: requirements -->
- Always start with these default items. No test command item: the result is records and a document.
  `- [ ] 분석 대상 소스·빌드 구성 후보와 제외 범위가 기준 커밋과 함께 있다` / `- [ ] 발견한 분석 항목마다 끝난 상태(완료 / 외부 근거 필요 / 범위 밖·보류와 이유)가 있다` / `- [ ] 모든 요구사항 후보와 제약이 근거(기준 커밋의 원본 위치, 또는 실행한 명령과 그 출력)로 이어진다` / `- [ ] 미확정·충돌·외부 검증 필요 항목이 따로 둔 절에 이유, 필요한 자료와 함께 있다` / `- [ ] 분석 범위와 누락 가능성, 검증 계획이 있다`
- Then add items that fit the request, one per line. Not how to analyze.
<!-- /type -->
- One verifiable sentence per line. Never include push or PR. They happen after verify, so verify cannot judge them.

## Done when

- `intent.draft.md` has all required sections: `목표`, `비목표`, `원하는 결과`, `완료조건`.
- Every 완료조건 line is a verifiable sentence.
- Items you could not draft without were asked, or left in `open_questions`.
<!-- type: general -->
- Every 완료조건 line ends with a check method.
<!-- /type -->
<!-- type: spec -->
- The target document's path is in `제약`.
<!-- /type -->
<!-- type: requirements -->
- `제약` has the 자료, 빌드 and 경계 lines.
<!-- /type -->

## Artifact template: `intent.draft.md`

No front matter: the app adds the type and version when the human approves.

```markdown
## 목표

## 비목표
- (없으면 "없음")

## 원하는 결과

## 완료조건
<!-- type: bugfix -->
- [ ] (기본 항목 세 개)
- [ ] …
- [ ] (요청에 맞는 항목)
<!-- /type -->
<!-- type: feature -->
- [ ] (기본 항목 세 개)
- [ ] …
- [ ] (인수 조건: "<조건>이면 <결과>")
<!-- /type -->
<!-- type: refactor -->
- [ ] (기본 항목 네 개)
- [ ] …
- [ ] (구조 조건: 코드를 읽거나 명령으로 확인할 수 있는 문장)
<!-- /type -->
<!-- type: spec -->
- [ ] (기본 항목 세 개)
- [ ] …
- [ ] (<무엇>을 정한다)
<!-- /type -->
<!-- type: requirements -->
- [ ] (기본 항목 다섯 개)
- [ ] …
- [ ] (요청에 맞는 항목)
<!-- /type -->
<!-- type: general -->
- [ ] (기본 항목 두 개) — 확인: (명령)
- [ ] … — 확인: …
- [ ] (요청에 맞는 항목) — 확인: (명령 / 읽을 곳 / 사람)
<!-- /type -->

## 제약
<!-- type: spec -->
- 설계 문서: `<경로>` (새 문서 / 기존 문서)
<!-- /type -->
<!-- type: requirements -->
- 자료: (없으면 "없음")
- 빌드: (허용 (툴체인 …) / 허용하지 않음 (까닭))
- 경계: (기본 외에 안까지 볼 것, 없으면 "기본". 서브모듈이 있으면 "서브모듈 안은 경계")
<!-- /type -->
- (선택)

## 추가 의견
<!-- type: bugfix -->
- (선택) (사람 추정, 확인 안 됨) …
<!-- /type -->
<!-- type: feature refactor spec general requirements -->
- (선택) (사람 제안) …
<!-- /type -->
```
