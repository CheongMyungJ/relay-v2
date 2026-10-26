- **Verdicts come from runs:** the safety-net tests, run on the final code.
- **"안전망 테스트가 있고 기준 코드에서도 통과한다":** run the safety-net tests at the safety-net commit (hash in `refactor.md`; the base commit when no new test was needed), in the same worktree:
  1. `git checkout --detach <safety-net commit>`.
  2. For each test marked (추가) in `refactor.md` (added later, not in that commit): `git checkout <work branch> -- <test file>`.
  3. Run the safety-net tests at the paths listed for the safety-net commit.
  4. `git reset --hard`, then `git checkout <work branch>`. The work branch (`작업 브랜치`) is in `context.md`.

  Run them on the final code too, at their current paths. 통과 only if both pass. Check that every changed place has a safety net that really catches its behavior. Accepted differences are exceptions. If a place had no safety net (reason in `refactor.md`), it is 판정 불가. Before you go on, confirm `git branch --show-current` is the work branch.
- **"레포 밖 공개 인터페이스가 바뀌지 않는다":** judge from the diff against the base commit whether anything used outside the repo changed (exports, HTTP API, CLI arguments, stored formats and schemas). Leave out what the intent says to change.
