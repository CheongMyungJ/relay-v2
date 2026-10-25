---
description: relay custom step (custom Work type). The shared base of every step a team defines in its own Work type; the step's own procedure, written by whoever defined the type, follows it.
---

# relay: custom step (커스텀 단계)

This Work has a type the team defined. Its steps run after intake, and this is one of them. The last step also finishes the Work: then these instructions end with `## Finishing the Work`. The name of this step, its artifact and that artifact's sections are in `context.md` (`## 커스텀 유형`). What to do in this step is under `## This step's procedure` below, written by whoever defined the type. Follow it within the rules here.

## Inputs

- relay gives you the path of `context.md` when the step starts. Read it first. It has the intent and the Work's base commit. If you need the request text, read `request.md` at the path in `context.md`. Read the artifacts of earlier custom steps at their paths in `context.md` (`필요한 산출물`).
- Do the work so that it meets the intent: its `목표`, `완료조건`, `비목표` and `제약`.

## Rules

- **Problems outside the scope:** do not fix them. Write them in `risks`. Fixing one widens the scope, which is a human decision.
- **Intent conflict:** if 완료조건 conflict or cannot be met, write it in `intent_deviation`. If the intent must change, ask the human: decide it within the intent and go on / start over as a new Work (see "When an earlier result is wrong" in the common rules).
- **Tests:** if you change how code behaves, add a test that catches that behavior. If you cannot add one (UI behavior, needs an external service, no way to run tests), write why in this step's artifact and in `risks`, and go on. Never weaken or delete existing tests.
- **Self-check:** for each 완료조건 this step takes on, run its check method (`— 확인: …` at the end of the line) for real and write the result in this step's artifact (in `완료조건별 자체 확인` if it has that section). For `확인: 사람`, write where the human should look. The Work's verdicts are judged on the final code when it finishes, so this is for comparison.
- **Commits:** this step may change code. Follow the repo's commit message convention. Commit all changes before you close. Revert experimental changes such as debug output. If the procedure says this step does not change code, keep to it.
- **A design document to follow:** if the intent's `제약` says "`<path>`의 결정을 따른다", departing from that design touches the constraints: ask the human. If they decide to change it, change the design document too, with the history and the human's decision, and commit it with the code.

## Done when

- This step's artifact (`<step id>.md`) has every section listed in `context.md`.
- The procedure below is done.
- Every change in code behavior has a test, or the reason it has none.
- Every change is committed.

## Artifact

Write `<step id>.md` in the task directory, with one `## <section>` heading for each section listed in `context.md`, in that order. Write the content in Korean.
