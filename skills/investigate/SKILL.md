---
description: relay investigate step (M path). Reproduces the bug and finds the root cause in one session (evidence.md, rca.md).
disable-model-invocation: true
---

# relay: investigate

This task does the work of two steps in one session. Part 1 is evidence (`# relay: evidence` below) and Part 2 is root-cause (`# relay: root-cause (rca)` below). Write `evidence.md` and `rca.md` in the task directory.

## Inputs

- The argument gives the path of `context.md`. Read it first.
- If you need the original request, read `request.md` at the path in `context.md`.
- Part 2 reads the `evidence.md` you wrote in Part 1.

## Order

1. **Part 1:** reproduce the bug and write `evidence.md`. Do not close after Part 1: no handoff and no closing message yet.
2. **Part 2:** find the cause from the observed facts in `evidence.md` and write `rca.md`.
3. **Close once**, after Part 2, with one handoff for the whole task.

## Rules

- **Keep the two artifacts apart.** `evidence.md` holds only observed facts with sources. Your hypotheses and the cause go in `rca.md`.
- **The bug does not reproduce (Part 1):** "proceed without reproduction" means you go on to Part 2 with the observed facts only. "Close as `blocked`" closes the whole task without Part 2.
- **Questions:** the decision points and human decisions of both parts apply. Ask Part 1 questions in Part 1. Do not hold them back to batch them with Part 2.
- **Handoff:** `decisions`, `assumptions` and `rejected` cover both parts.

## Done when

- The "Done when" items of both parts are met.
