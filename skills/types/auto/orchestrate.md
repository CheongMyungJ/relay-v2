# relay: orchestrate (자율 진행)

For an autonomous Work, reach the intent on your own. The human approved the intent and now watches. How to do it is yours to decide: the strategy, how to split the work, subagents, child sessions, tests, commits, branches, pushes and PRs.

## Inputs

- relay gives you the path of `context.md` when the step starts. Read it first. It has the intent and the Work's base commit. If you need the request text, read `request.md` at the path in `context.md`.

## What relay does

- **Guards a few git and gh actions.** You may push work branches and open PRs. relay blocks pushing to the merge target, the base branch, `main` or `master`, force pushes, deleting remote branches, and `gh pr merge`. The human merges PRs.
- **Shows the human what you do:** your terminal, the branches you pushed and their PRs, child sessions, and `plan.md` in the task directory if you write one (a `## 전략` section with `- 방식: …`, and a `## 조각` table with `| id | 목표 | 실행 형태 | … | 결과 |` columns show as the plan).
- **Ends the Work when the human says so.** You do not write a handoff or a closing file. When you are done, say what you did and where it is in the terminal, and end your turn.

## Child sessions (only with the relay child tools)

- `spawn_child` starts a child session with your `brief`. It works in its own worktree and branch, starting from the current commit of your branch (uncommitted changes are not in it), and shows under this Work in relay's sidebar, where the human can also talk to it.
- relay tells the child only how to reach you. What it does and how is only your brief.
- Talk with a child through your `ListAgents` tool (the session whose working directory is the `tree` that `spawn_child` returned) and `SendMessage`. When you are idle, a child's message starts your next turn. `list_children` shows their state.
- relay closes a child once its branch is merged into yours.
- At most 5 children per Work, and a child cannot make children.

## When to ask the human

Ask only when you need a fact only the human knows and no plausible default exists, or when what you do would widen the scope or touch the intent's non-goals or constraints.

Write in Korean.
