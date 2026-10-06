---
description: relay spec step (spec Work). Settles the design decisions with the human topic by topic, writes them into the design document in the repo and commits it (spec.md). Does not change code.
disable-model-invocation: true
---

# relay: spec (설계 문답)

For a spec Work, settle with the human, one by one, what the intent says to decide, and write it into the design document in the repo. Unlike the other steps you do not draft first: ask every decision of each topic. This step does not change code. It changes only the target document, and commits it. Write the progress record `spec.md` in the task directory.

## Inputs

- The argument gives the path of `context.md`. Read it first. It has the intent and the Work's base commit. The target document's path is in the intent's `제약` ("설계 문서: `<path>` (새 문서 / 기존 문서)"). If you need the request text, read `request.md` at the path in `context.md`.
- **Continuing on the current document** (chosen when rewinding to spec): keep the decisions in the document as they are. Start from the human's extra instructions, and from `다시 볼 결정` in the discarded `verification.md` if there is one (paths in `context.md`). Read the discarded `spec.md` and write a new `spec.md`. Copy the decisions the human made in the discarded attempt (its `handoff.md` next to the discarded `spec.md`, or its `문답 기록`) into `decisions` with `by: human`, so the human-decision marks in the document still match your handoff.

## Order

1. **Read** the code and the target document.
2. **Topic list:** show it to the human and get it confirmed.
3. **Each topic:** explain the issue, then ask its question batch.
4. **Write** each decision into the document as soon as you get the answer.
5. **Re-read** the whole document when every topic is settled, and fix contradictions between topics and statements that differ from the current code.
6. **Commit** the target document.

## Topic list

- Start from the intent's "<무엇>을 정한다" items and add the issues you found reading the code. End the list with "구현 나눔": the split into Works, their order, and a goal of a line or two for each piece.
- Write the list in terminal text, then confirm it with `AskUserQuestion`. Adding an issue the intent does not have widens the scope, and dropping a topic changes it: the human decides both here. The human can also change the order or drop 구현 나눔.

## Questions

- One topic at a time. First explain the issue or a scenario briefly in terminal text (option descriptions are short). Then ask one `AskUserQuestion` batch (up to 4 questions) for the topic.
- Every question has options. Put the recommended option first with "(추천)", and give the reason in its description.
- Issues that come up from the answers go in the next batch.
- **Human suggestions:** a "(사람 제안)" in the intent's `추가 의견` is not decided yet. When you ask its topic, show it as an option marked "(사람 제안)", and still ask. What the intent's `제약` says is a must: do not ask it, write it in the document as the human's decision.
- **Ask every decision of the topic.** The details you fill in while writing the document (names, section layout, small rules that come from writing a decision down) are yours: mark them "사람이 정하지 않음" in the decision table and record them in `decisions` with `by: ai`.

## Rules

- **Writing the document:** write each decision as soon as you get it, so the document keeps it even if this conversation is compacted. Every decision has a reason. Mark the decisions the human made. Put what is left undecided in a separate section, with the reason. Otherwise follow the target document's conventions: for an existing document, use its decision table and numbering; for a new one, use the template below. The app does not check the format.
- **Experiments:** do not guess how a tool or the current code behaves. Read its docs or run it. Revert the experimental code and temporary files when you close. Write what you checked and how in the reason of that decision and in `확인한 것` of `spec.md`.
- **Knowledge:** design decisions are not knowledge candidates: they live only in the design document. Put in `knowledge_candidates` only what the human told you that holds beyond this design (a rule, a convention, a business fact, e.g. "스키마 변경은 마이그레이션 PR을 따로 낸다").
- **Commit:** this step changes the target document. Commit it before you close. Do not change any other file. Knowledge files are not yours to write: verify writes them from your `knowledge_candidates`.
- **Intent conflict:** if "<무엇>을 정한다" items conflict or cannot be decided (e.g. it depends on an outside condition not known yet), ask the human. If they leave it undecided, write it in the undecided section. If the intent must change, write it in `intent_deviation` and set `recommended_next` to `intake`.

## Decision points

- The topic list and its order, and every decision of each topic. Ask the human about all of them.

## Human decisions

Ask on the spot:

- The topic list: the issues you add beyond the intent, the topics to drop, the order, and whether to keep 구현 나눔.
- Every decision of every topic.

## Done when

- `spec.md` has all four template sections.
- Every "<무엇>을 정한다" item of the intent and every issue the human added has a decision in the document, or is in the undecided section with the reason.
- Every decision has a reason, the human's decisions are marked, and they are in `decisions` with `by: human`.
- You re-read the whole document and fixed contradictions between topics and statements that differ from the current code.
- The target document is committed, and no other file changed (experiments reverted).

## Artifact template: `spec.md`

```markdown
## 주제 목록
1. 주제 — 정함 / 정하지 않음(이유) / 사람이 뺌

## 문답 기록
### 주제 1. <이름>
- 질문 — 고른 답(추천과 같음 / 추천 대신 고름 / 의견을 더함) — 문서에 옮긴 곳

## 확인한 것
- 무엇 — 방법(읽은 문서, 실행한 것) — 결과 (없으면 "없음")

## 문서 변경
- 대상 문서 — 더하거나 고친 절, 결정 번호, 커밋
```

## Template for a new design document

```markdown
# <설계 이름>

## 개요
(무엇을 왜 만드는지, 범위와 비목표)

## 결정
| # | 결정 | 이유 | 사람 결정 |
|---|---|---|---|

## <주제별 절>

## 정하지 않은 것
- 무엇 — 왜 정하지 않았는지, 누가 언제 정하나 (없으면 "없음")

## 구현 나눔
(정했을 때만)

## 변경 이력
```
