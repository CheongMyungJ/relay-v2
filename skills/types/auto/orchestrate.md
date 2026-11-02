# relay: orchestrate (자율 진행)

For an autonomous Work, reach the intent on your own. The human approved the intent and now only watches: you pick the strategy, split the work, do it, check it, and finish the Work. Write the plan and what happened in `plan.md` in the task directory. This is the step that changes code.

## Inputs

- relay gives you the path of `context.md` when the step starts. Read it first. It has the intent and the Work's base commit. If you need the request text, read `request.md` at the path in `context.md`.

## Order

1. **Read** the intent and the code it touches, enough to judge the size and the risk.
2. **Pick the strategy** (below) and **split the work into pieces** (below). Write `## 전략` and `## 조각` of `plan.md` before you change code.
3. **Do the pieces** in the order the plan says. Commit as you go. Mark each piece's `결과` when it is done.
4. **Change the plan when it is wrong.** If a piece turns out bigger, a strategy does not work, or you find a better split, change `## 전략` or `## 조각` and add one line to `## 바뀐 계획`: what changed and why.
5. **Self-check.** For each 완료조건, run its check method (`— 확인: …` at the end of the line) and write the result.
6. Run the repo's test command at the end.

## Picking the strategy

Look at the signals, not at how big the request sounds. The first line of `## 전략` is `- 방식: <name>` with one or more names from this table, joined with ` + ` (e.g. `- 방식: 설계 먼저 + TDD`). Then write which signals you saw.

| Name | Signals | What it asks of you |
|---|---|---|
| `바로 고침` | The place to change is narrow and a way to check it already exists | Change it. If behavior changes, add a test that catches it |
| `재현 시험 먼저` | Current behavior is wrong and the cause is not certain | First commit a test that fails on the current code, then fix |
| `안전망 먼저` | Structure changes and behavior must stay | First commit tests that pin the current behavior, then change the structure in small commits |
| `TDD` | New behavior with clear inputs and outputs | Commit the test before the code that makes it pass |
| `설계 먼저` | The change spans several modules, or a public interface or data shape changes | Write `## 설계` in `plan.md` first (below), then the pieces |
| `스파이크 먼저` | You do not know whether an approach works (performance, an external tool, a library's behavior) | Try it in the smallest way first, then fix the plan from what you learned. Revert the spike if it is not the final code |

- relay checks the claim: with `재현 시험 먼저`, `안전망 먼저` or `TDD`, a commit that changes only tests must come before the first commit that changes other code. Pick these only when you will work that way. If you end up working another way, fix `방식` and say why in `## 바뀐 계획`.
- When unsure between a light and a heavy strategy, start light and move up when a signal appears. Moving up is a plan change, not a failure.

## Splitting into pieces

Each piece has a goal, how it runs, the files it owns, and when it is done. Pick how each piece runs:

| How it runs | Use it when |
|---|---|
| `직접` | It needs what you already know in this conversation, or it is small |
| `서브에이전트` | You need an answer, not a code change: searching a large code base, reading logs, checking a finding, reviewing a piece from a fresh context. Use your subagent tool if you have one; give it a full brief (paths, the question, what to return). Otherwise do it `직접` |
| `자식 Work` | Only if you have the relay child tools (`spawn_child` and the others, below). A code change that can run in parallel with the rest and owns files no other running piece touches: a separate module, an independent fix, a change that could be its own PR or branch |

- One piece is fine. Small work has one `직접` piece and a short plan: do not split for the sake of it.
- **Separate branches or PRs per part:** if the intent asks for a separate branch or PR for each part, child sessions fit: each keeps its own branch, and `decide_child` with `merge` or `pr` delivers it. You may also make the branches yourself. Decide by what the work needs.
- Split only when the cost of splitting (a fresh context reading the code again, merging results) is clearly smaller than doing it in one go.
- Subagents do not change code in this Work. Code changes happen in this session or in child sessions, so the commits stay in an order you control.

## Child sessions (only with the relay child tools)

A child session works on one piece in its own worktree and branch, as its own Work in relay's sidebar. relay gives it only connection rules (where to work, how to talk to you, how to say it is done); **what it does and how is only what you write in the brief**. Whether to use child sessions at all, for which pieces, and what to put in each brief is your decision. relay allows at most 5 per Work, and a child cannot make children.

1. **Commit first.** A child starts from the current commit of your branch. Uncommitted changes are not in it.
2. **Spawn** with `spawn_child`: a one-line `title`, the `brief`, and the `files` it owns. A good brief says the goal, the files it may touch, what not to do, how to know it is done, and which tests to add and run. Give each child files no other running piece touches. Write the child's work id in the piece's `결과`.
3. **Talk while it works.** Find the child with your `ListAgents` tool (the session whose working directory is the `tree` that `spawn_child` returned) and message it with `SendMessage`. The child can message you the same way; its messages arrive between your tool calls.
4. **Wait** with `wait_children`, passing the `state_key` of each child you have seen as `seen`. Keep `timeout_sec` short while you expect messages: a message waits until the call returns.
5. **Answer** a child that is blocked on a question with `answer_child`. If only the human knows the answer, ask the human first, then pass it on.
6. **Decide** each child when it is done, with `decide_child`:
   - `merge`: the child completes without delivery; then run `git merge --no-ff <its branch>` in your worktree, resolve conflicts yourself, and run the tests again. Your own finishing reviews the merged result.
   - `pr` with `pr_title` and `pr_body`: relay runs an independent review of the child first and opens its own PR only if there is no 차단 finding. Only for a child that started from your base commit (`on_parent_changes: false`).
   - `revise` with a `message`: what to fix. The child reopens and goes on.
   - `discard`: drop it, and do that piece another way.
7. relay does not let you finish while a child is undecided. relay checks the tests and reviews your whole result when you finish, merged children included.

## `## 설계` (only with `설계 먼저`)

Add a `## 설계` section to `plan.md` after `## 전략`: the interfaces and data shapes that change, which module does what, and the alternatives you did not take with the reason. Keep it short. If the intent asks you to change a design document in the repo, change that document and point to it here.

## Rules

- **Tests:** if you change how code behaves, add a test that catches that behavior. If you cannot add one (UI behavior, needs an external service, no way to run tests), write a line `- (테스트 못 더함) 바꾼 동작 — 이유` in `변경 요약` and add it to `risks`. relay checks this: if code other than tests and documents changed and no test file changed, `변경 요약` must have that line.
- **Self-check:** run each 완료조건's check method for real and write the result in the `완료조건별 자체 확인` table. For `확인: 사람`, write where the human should look. The Work's verdicts are judged on the final code when it finishes, so this table is for comparison.
- **Commits:** any number. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output.
- **Run tests:** run the repo's test command (find it in the repo, e.g. `npm test`). For each failure, check whether it also fails at the base commit (from `context.md`), and say which. If the repo has no tests, write that in `테스트 실행`.
- **Problems outside the scope:** do not fix them. Write them in `risks`. Fixing one widens the scope, which is a human decision.
- **Intent conflict:** if 완료조건 conflict or cannot be met, write it in `intent_deviation`. If the intent must change, ask the human (see "When an earlier result is wrong" in the common rules).

## Decision points

- The strategy, the pieces, how each piece runs, which tests to add. Decide them yourself and record the main ones in `decisions` with `by: ai`. With 결정마다 확인, ask before you settle the plan.

## Human decisions

The human watches and does not steer. Ask on the spot only in these cases. In any other case, decide yourself and record it in `decisions`.

- You need a fact only the human knows (a rule that is not in the code or the intent), and no plausible default exists.
- What you do widens the scope, or touches the intent's non-goals or constraints.
- You do not take a human suggestion ("(사람 제안)" in `추가 의견`).

## Done when

- `plan.md` has all six template sections (`## 설계` too, with `설계 먼저`), and `방식` is the way you really worked.
- Every piece in `## 조각` has a `결과`, and every child Work is decided (merged, its own PR, or discarded).
- Every 완료조건 has the result of running its check method (where to look, for `확인: 사람`).
- Every change in code behavior has a test, or a `(테스트 못 더함)` line with the reason.
- Every change is committed.
- You ran the repo's test command and wrote the result, or wrote that the repo has no tests.

## Artifact template: `plan.md`

```markdown
## 전략
- 방식: 바로 고침
- 본 신호: (어떤 신호를 보고 골랐는지)
- 고려한 대안: 대안 — 기각 이유 (없으면 "없음")
- 사람 제안 판정: 제안 — 받아들임 / 받아들이지 않음(사람이 정함) — 이유 (없으면 "없음")

## 조각
| id | 목표 | 실행 형태 | 맡는 파일 | 끝난 조건 | 결과 |
|---|---|---|---|---|---|
| p1 | (무엇을) | 직접 | `src/…` | (확인할 것) | 끝남, 커밋 abc1234 |

## 바뀐 계획
- (없으면 "없음") 무엇을 왜 바꿨는지

## 변경 요약
- 파일 — 무엇을 바꿨는지, 커밋
- (테스트 못 더함) 바꾼 동작 — 이유

## 완료조건별 자체 확인
| 완료조건 | 한 일 | 확인 결과 |
|---|---|---|
| (완료조건 그대로) | — | `npm test` 실행, 통과 |

## 테스트 실행
- 명령:
- 결과:
- 실패 항목: 기준 커밋에서도 실패 / 이번 변경 뒤 실패
```
