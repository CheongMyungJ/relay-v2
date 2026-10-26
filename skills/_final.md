## Finishing the Work

This step is the last work step of this Work (`context.md` has `## 마무리`). There is no separate review step after it: after this step's own work, you also finish the Work here. relay runs an independent review of the whole change for you, and your approval screen is the Work completion screen, always manual. In the order below, step 1 is this step's own procedure above; steps 2–11 come after it.

### Finishing order

1. **This step's work:** follow the order and `Done when` above. Where they say to close with `status: awaiting_approval`, do not close yet: go on to step 2.
<!-- type: bugfix feature refactor general custom -->
2. **Verdict table:** judge each 완료조건 of the intent on the final code, and write `## 완료조건 판정` of `verification.md` in the task directory (template below). Use the results of runs you already did on this same code; run again what you have not run on it. Write only this section now.
<!-- /type -->
<!-- type: spec -->
2. **Verdict table:** judge each 완료조건 of the intent on the final document, and write `## 완료조건 판정` of `verification.md` in the task directory (template below). List every changed file outside the target document and the knowledge files in `## 문서 밖 파일 변경`. Write only these two sections now.
<!-- /type -->
3. **Request the review:** commit every change. Write the handoff with `status: review_requested` (the rest of the handoff as usual), print `리뷰 요청 안내 문구` from `context.md` verbatim, and end your turn. relay closes this session, runs the independent review, and reopens this same conversation with the result. Request the review once only.
4. **Read the result:** when relay reopens the conversation, read `independent-review.md` (path in `context.md`). Copy its `## 지적` to `## 리뷰 지적` in `verification.md`, keeping the numbers, severity, file and line, the check result and the failure scenario (template below). If the code review was off, write "없음 — 코드 리뷰를 끔". If the review failed, write "없음 — 독립 리뷰 실패: <reason>" and add it to `남은 위험`.
<!-- type: bugfix feature refactor general custom -->
   Copy its `## 나중에 정리할 곳` to the same section of `verification.md`.
<!-- /type -->
<!-- type: spec -->
   A decision with a better alternative or a missed risk is not a finding: write it yourself in `## 다시 볼 결정`. It is not picked; the Work completion screen and `pr.md` only show it. To change it, the human tells you before approving: then decide it like a new decision.
<!-- /type -->
5. **Pick findings** (human decision below). Skip this if there are no findings.
<!-- type: bugfix feature refactor general custom -->
6. **Apply** only the picked findings and commit. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not request the review again, and do not add new findings.
<!-- /type -->
<!-- type: spec -->
6. **Apply** only the picked findings to the target document and commit. Fill in `## 반영` and `## 반영하지 않은 지적`. Do not request the review again, and do not add new findings.
<!-- /type -->
7. **Fix the verdicts:** answer each item of `## 판정표 이의` in `independent-review.md`: if you accept it, fix the verdict or check again; if you do not, add why to that verdict's evidence. Run again every 완료조건 that the applied changes touch, and fix the table on the final code. Ask about 실패 and 판정 불가 as below.
8. **The other sections:** fill in the rest of `verification.md`.
<!-- type: bugfix feature refactor general custom -->
9. **Write `pr.md`** (template below). If the code review was off, write "독립 코드 리뷰를 하지 않음" in `## 테스트`.
<!-- /type -->
<!-- type: spec -->
9. **Write `pr.md`** (template below). If the code review was off, write "독립 코드 리뷰를 하지 않음" in `## 변경`.
<!-- /type -->
10. **Knowledge:** if `context.md` has `### 지식 남기기`, write the knowledge files as it says, and commit them.
11. **Close** with the common closing procedure and `status: awaiting_approval`. The handoff replaces the one of step 3: keep every decision of this step in `decisions`, those before the review too. Print `마무리 안내 문구` from `context.md`.

### Finishing rules

<!-- type: bugfix feature refactor general custom -->
- **Code:** after the review, change code only for the findings the human picked, for a verdict you fix, or for a 실패 the human chose to fix here. Commit those changes. Revert any other experimental change when you close.
<!-- /type -->
<!-- type: spec -->
- **Document:** after the review, change the target document only for the findings the human picked, and commit. Do not change code. Revert any experimental change when you close.
- **A finding that needs a new decision:** ask the human on the spot, in the same shape as this step asks: options, the recommended one first with "(추천)", and the reason in its description. Change the document and its decision table by the answer, and mark it as the human's decision.
- **Verdicts on the document:** judge each 완료조건 by reading the document and the diff. Judge "대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다" from the diff against the base commit, and list every other changed file in `문서 밖 파일 변경`.
<!-- /type -->
<!-- type: bugfix -->
- **Reproduction steps:** do not change code that they use. If a picked finding needs it, write in `반영` how the steps change, and reproduce with the changed steps.
- **Verdicts come from runs:** the reproduction steps and the reproduction test, run on the final code.
<!-- /type -->
<!-- type: feature -->
- **Verdicts come from runs:** the new behavior tests, run on the final code.
- **"완료조건의 각 동작을 확인하는 테스트가 있다":** for each 완료조건, check that a test exists and really checks that behavior, and run it on the final code. For failing before the change, use the record in `implement.md`. A test for a 완료조건 that keeps the current behavior may pass before the change. If a behavior has no test, it is 판정 불가.
<!-- /type -->
<!-- type: refactor -->
- **Verdicts come from runs:** the safety-net tests, run on the final code.
- **"안전망 테스트가 있고 기준 코드에서도 통과한다":** run the safety-net tests at the safety-net commit (hash in `refactor.md`; the base commit when no new test was needed), in the same worktree:
  1. `git checkout --detach <safety-net commit>`.
  2. For each test marked (추가) in `refactor.md` (added later, not in that commit): `git checkout <work branch> -- <test file>`.
  3. Run the safety-net tests at the paths listed for the safety-net commit.
  4. `git reset --hard`, then `git checkout <work branch>`. The work branch (`작업 브랜치`) is in `context.md`.

  Run them on the final code too, at their current paths. 통과 only if both pass. Check that every changed place has a safety net that really catches its behavior. Accepted differences are exceptions. If a place had no safety net (reason in `refactor.md`), it is 판정 불가. Before you go on, confirm `git branch --show-current` is the work branch.
- **"레포 밖 공개 인터페이스가 바뀌지 않는다":** judge from the diff against the base commit whether anything used outside the repo changed (exports, HTTP API, CLI arguments, stored formats and schemas). Leave out what the intent says to change.
<!-- /type -->
<!-- type: general custom -->
- **Check methods:** run the method at the end of each 완료조건 line on the final code. If it does not really check that 완료조건 (e.g. the command never runs that behavior), add your own check (read the code, run more), judge with both, write both in the evidence, and write in `남은 위험` that the check method fell short. Do not change the intent.
- **`확인: 사람` items:** judge them by asking the human (see the human decisions below). Before you ask, check what you can yourself and show it.
<!-- /type -->
- **Verdicts:** 통과 / 실패 / 판정 불가. For 판정 불가, give the reason, and add useful facts if any.
<!-- type: bugfix -->
  For example, the reproduction test passes in a Work that never reproduced the bug. If the Work proceeded without reproduction, "재현 절차가 더 이상 실패하지 않는다" is 판정 불가. If there are neither reproduction steps nor a reproduction test, it is 판정 불가 too.
<!-- /type -->
- **A finding says the change itself is wrong** (e.g. it only hides the symptom): if the human picks it, fix it here. If the intent, the cause or the design is wrong and the work must start over, ask the human: fix it here / start over as a new Work (see "When an earlier result is wrong" in the common rules). There is no going back to an earlier step.

### Finishing decisions

- **Decision points:** how to fix a picked finding, whether to accept each objection to the verdicts, and the verdict of each 완료조건. With 결정마다 확인, ask before you change code and before you settle the verdicts.
- **Which findings to apply** (only when there are findings): ask on the spot. In one question, list each finding in one line (number, severity, what). Offer: 차단·권장만 반영 / 모두 반영 / 반영하지 않음, and put the one you recommend first. The human can also type the numbers. Record what they picked and what they did not in `decisions` with `by: human`.
<!-- type: general custom -->
- **`확인: 사람` items:** gather them all into one question. For each, show what to look at (file, diff location, run result). The human's answer decides 통과 or 실패. Write "사람 확인" and the answer in the evidence, and record the answer in `decisions` with `by: human`.
<!-- /type -->
- **Any 실패 or 판정 불가:** let the human choose:
  - Fix it here: fix and commit, and judge again on the final code. Write what you did in `반영`.
  - Go to the completion screen as is. The screen shows a warning.
  - Start over as a new Work: write a Work draft and close as `blocked` (see the common rules).

### Finishing done when

<!-- type: bugfix feature refactor general custom -->
- When you request the review: this step's `Done when` is met, `verification.md` has `## 완료조건 판정`, and every change is committed.
- When you close with `awaiting_approval`: `verification.md` has all six template sections; if there were findings, the human picked and the picked ones are fixed and committed; every objection is answered; every 완료조건 of the intent has a verdict and evidence on the final code.
<!-- /type -->
<!-- type: spec -->
- When you request the review: this step's `Done when` is met, `verification.md` has `## 완료조건 판정` and `## 문서 밖 파일 변경`, and every change is committed.
- When you close with `awaiting_approval`: `verification.md` has all seven template sections; if there were findings, the human picked and the picked ones are applied and committed; every objection is answered; every 완료조건 of the intent has a verdict and evidence on the final document and the diff; `다시 볼 결정` is written.
<!-- /type -->
- `pr.md` is written. If `context.md` has `## 레포`, a PR draft is written for every repo with commits, at the path given there.
- Any 실패 or 판정 불가 was asked about, and the answer recorded in `decisions`.
<!-- type: general custom -->
- Every `확인: 사람` item was asked about, and the answer recorded in `decisions`.
<!-- /type -->

### Artifact template: `verification.md`

```markdown
## 리뷰 지적
<!-- type: bugfix feature refactor general custom -->
1. [차단 / 권장 / 사소] 파일:줄 — 무엇이 문제인지와 제안 (확인됨 / 가능성)
   실패 시나리오: 어떤 입력·상태에서 무엇이 틀리는지 (정리 지적은 드는 비용, 가능성이면 무엇이 확인해 줄지)
<!-- /type -->
<!-- type: spec -->
1. [차단 / 권장 / 사소] 파일:줄 — 무엇이 문제인지와 제안
<!-- /type -->
(지적이 없으면 "없음")

## 반영
<!-- type: bugfix -->
- 지적 번호 — 한 일, 커밋, 돌린 테스트와 결과 (재현 절차를 바꿨으면 달라진 절차)
<!-- /type -->
<!-- type: feature refactor general custom -->
- 지적 번호 — 한 일, 커밋, 돌린 테스트와 결과
<!-- /type -->
<!-- type: spec -->
- 지적 번호 — 문서에서 고친 곳, 커밋
<!-- /type -->
(사람이 고른 것이 없으면 "없음")

## 반영하지 않은 지적
- 지적 번호
(없으면 "없음")

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
<!-- type: bugfix feature refactor general custom -->
| (완료조건 그대로) | 통과 | 실행한 명령과 결과 |
<!-- /type -->
<!-- type: spec -->
| (완료조건 그대로) | 통과 | 읽은 곳(문서의 절, diff) |
<!-- /type -->

<!-- type: bugfix feature refactor general custom -->
## 나중에 정리할 곳
- 파일·모듈 — 무엇이 문제인지, 정리하면 좋을 까닭
(없으면 "없음")
<!-- /type -->
<!-- type: spec -->
## 문서 밖 파일 변경
- 파일 — 무엇이 바뀌었는지
(대상 문서와 지식 파일 밖의 변경이 없으면 "없음")

## 다시 볼 결정
- 결정 — 더 나은 대안이나 놓친 위험
(없으면 "없음")
<!-- /type -->

## 남은 위험
- 
```

### Artifact template: `pr.md`

- The first line is `# <PR title>`. The app uses it as the PR title and the rest as the body.
- Write it in the language the repo uses (recent commits and PRs), not necessarily Korean.
- If the repo has a PR template (e.g. `.github/pull_request_template.md`), follow its structure. Otherwise use the sections below, in that language.
- **Several repos:** if `context.md` has `## 레포`, this Work changes more than one repo, and each repo gets its own PR. Write one draft per repo that has commits since its base commit, at the path `## 레포` gives (`pr.md` for the main repo, `pr/<submodule path>.md` for a submodule), in that repo's language and PR template. Each draft covers only that repo's change. The main repo's draft also lists the submodules changed with it and that their PRs merge first; the app adds their links. If the main repo is not changed, write no `pr.md`. The verdicts in `verification.md` still cover all repos together.
<!-- type: bugfix -->

```markdown
# PR 제목

## 요약
## 원인
## 변경
## 테스트
```
<!-- /type -->
<!-- type: feature -->
- `동작`: what the user scenarios in `design.md` can now do. Split it into 새로 되는 것 / 바뀌는 것 / 없어지는 것, only those that apply. `호환성`: only when a 완료조건 is marked "(레포 밖 인터페이스)": what breaks for users outside the repo and how they move over; otherwise leave the section out. `주요 설계 결정`: the chosen way and rejected alternatives, briefly.

```markdown
# PR 제목

## 요약
## 동작
## 호환성
## 주요 설계 결정
## 변경
## 테스트
```
<!-- /type -->
<!-- type: refactor -->
- `목표 구조`: the new shape and rejected alternatives, briefly. `동작 보존`: safety-net counts (existing, new, passed at the safety-net commit), accepted differences, places changed without a safety net. `변경`: commits by step. `찾은 버그`: copy the bugs found (not fixed) from `refactor.md`, or "없음".

```markdown
# PR 제목

## 요약
## 목표 구조
## 동작 보존
## 변경
## 찾은 버그
## 테스트
```
<!-- /type -->
<!-- type: general custom -->
- `주요 결정`: the chosen way, rejected alternatives and what the human decided, briefly.

```markdown
# PR 제목

## 요약
## 주요 결정
## 변경
## 테스트
```
<!-- /type -->
<!-- type: spec -->
- `주요 결정`: what the human decided, with rejected alternatives, briefly. `다시 볼 결정`: copy from `verification.md`, or "없음". `정하지 않은 것`: or "없음". `구현 나눔`: only when it was decided; the pieces and their order. `변경`: which sections of the document were added or changed.

```markdown
# PR 제목

## 요약
## 주요 결정
## 다시 볼 결정
## 정하지 않은 것
## 구현 나눔
## 변경
```
<!-- /type -->
