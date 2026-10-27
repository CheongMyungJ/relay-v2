---
description: relay intake step. Turns the Work request into an intent draft (intent.draft.md).
---

# relay: work-start (intake)

Read the request, talk with the human, and write the intent draft `intent.draft.md` in the task directory. The human confirms it on the intent approval screen. That approval is always manual.

## Inputs

- relay gives you the path of `context.md` when the step starts. Read it first. For intake it contains the request text (`request.md`) in full, and the Work type (`업무 유형`) the human picked.
- **Starting over from an earlier Work:** if the request carries the approved intent of an earlier Work (see "Starting over" in the common rules), start from that intent and revise it to fit the request's instructions. Do not rewrite from scratch.

## Rules

- **This step does not change code.** Skim the code only enough to write concrete goals and completion criteria. Do not plan how to do the work. That is the job of the steps after this one.
- Do not write how to do the work in the intent. The only exception is the human's suggestions below.
- **Human suggestions:** if the request says how to do it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". The steps after this one decide whether to take it.
<!-- if: custom -->
- **The custom type:** the human picked a Work type their team defined. Its name, description and steps are in `context.md` (`## 커스텀 유형`). If the request does not fit that description, or a built-in type (`bugfix`, `feature`, `refactor`, `spec`, `general`) fits it clearly better, say which and why before you write the draft, and ask: keep this type / change the type (`blocked`). If they keep it, draft with this type.
<!-- /if -->
- **The type's intake instructions:** if these instructions end with `## This Work type's intake instructions`, follow them as well. They come from the Work type's definition and take precedence over the general rules here.
- **Vague goals:** if the goal is vague ("정리해 줘"), ask for a result that can be checked.
- **Type mismatch:** the human picked the type: `bugfix` (버그 수정: current behavior is wrong), `feature` (기능 추가·변경: new behavior, or changing or removing a behavior that works as intended now), `refactor` (리팩터링: change structure, keep behavior), `spec` (설계: settle only the design of big work before building it), `general` (일반: work that fits none of these, e.g. config, CI, docs, dependency upgrades, mixed work), or a type the team defined (`custom`: its description is in `context.md`). If it does not fit the request (e.g. `feature`, but the request says current behavior is wrong), ask before you write the draft. If the human wants to change the type, write a Work draft with the new type and the request as it is (see "Starting over" in the common rules), and close as `blocked`. If they keep it, draft with the picked type. Never change the type yourself.
- **A design document to follow:** if the request points to a design document in the repo, write "`<path>`의 결정을 따른다" in `제약`, and write the part this Work takes on as goals and completion criteria. If that document is not in the worktree (its design PR is not merged yet), tell the human before you write the draft and ask: wait for the merge (`blocked`) / go on from the request alone, without the document.
- **Your own hypotheses** do not go in the intent. Put them only in the handoff section `## 다음 task가 알아야 할 것`, as reference.
- Keep the intent around 1,500 characters. It goes into every task.

## Decision points

Scope (`비목표`) and completion criteria (`완료조건`). This step has no human decisions.

- 초안 우선: ask only what you cannot draft without, such as the expected behavior.
- 결정마다 확인: ask about both decision points before writing the draft.
- If the human answers "모름" to something you cannot draft without, draft the most plausible value and keep that item in `open_questions`. The human sees it on the approval screen.

## 완료조건 section

- If the type's intake instructions give default items, always start with them.
- Write the items that fit the request, one per line. Not how to do the work.
<!-- if: check-method -->
- **Check method:** end every line with ` — 확인: <방법>`: a command to run, a place to read (a file or a code location), or `사람`. Use `사람` only when no command and no place to read can check it. The app rejects a line without a check method.
<!-- /if -->
<!-- if: code -->
- No line that only says the repo's tests pass or that existing tests are kept, unless the request is about the tests themselves. Every step runs the repo's tests, and the review reads the whole diff.
<!-- /if -->
- One verifiable sentence per line. Never include push or PR. They happen after the Work completes, so they cannot be judged.

## Done when

- `intent.draft.md` has all required sections: `목표`, `비목표`, `원하는 결과`, `완료조건`.
- Every 완료조건 line is a verifiable sentence.
- Items you could not draft without were asked, or left in `open_questions`.
<!-- if: check-method -->
- Every 완료조건 line ends with a check method.
<!-- /if -->
- What the type's intake instructions ask for is in the draft.

## Artifact template: `intent.draft.md`

No front matter: the app adds the type and version when the human approves.

```markdown
## 목표

## 비목표
- (없으면 "없음")

## 원하는 결과

## 완료조건
<!-- if: check-method -->
- [ ] (요청에 맞는 항목) — 확인: (명령 / 읽을 곳 / 사람)
- [ ] … — 확인: …
- [ ] (요청에 맞는 항목) — 확인: (명령 / 읽을 곳 / 사람)
<!-- /if -->
<!-- if: no-check-method -->
- [ ] (기본 항목: 유형의 intake 지시에 있을 때)
- [ ] …
- [ ] (요청에 맞는 항목)
<!-- /if -->

## 제약
- (선택)

## 추가 의견
- (선택) (사람 제안) …
```
