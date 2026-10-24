---
kind: pitfall
source: investigation
---
# Windows의 Work worktree에서 검사를 돌릴 때

## 내용
- 새 worktree에는 `app/node_modules`가 없다. `npm ci` 뒤 Electron 바이너리가 없으면 `node node_modules/electron/install.js`로 받는다.
- app 시험을 파일 하나만 돌리기 전에 `npm --prefix app run contracts`가 필요하다(`app/src/shared/generated`의 handoff 스키마를 만듦). 없으면 `validate.ts`의 import에서 실패한다. `npm --prefix app test`는 이것을 먼저 돌린다.
- worktree가 `core.autocrlf=true`라 `npm run format:check`가 손대지 않은 파일까지 CRLF로 잡는다. 바꾼 파일만 `npx prettier --check --end-of-line auto <파일들>`로 본다.
- Git Bash의 `sed -i`는 CRLF 파일의 CR을 지운다. 커밋하면 맞춰지지만 작업 트리의 줄 끝이 바뀌므로 스킬·문서는 편집 도구로 고친다.
- Git Bash(bash 5.2 msys)는 명령 치환 `$(…)` 안의 `$'\r'`에서 CR을 뺀다. 그래서 `echo "$(grep -c $'\r$' <파일>)"`은 `grep -c '$'`가 되어 CR이 없는 파일도 모든 줄 수를 낸다. CR 수는 명령 치환 밖에서 `grep -c $'\r' <파일>`이나 `tr -cd '\r' < <파일> | wc -c`로 센다.
- `npm --prefix app test` 전체는 약 22~28분 걸린다(2026-10). 백그라운드로 돌리고, 도는 동안 `tsc -b`, `eslint`, 다른 vitest 같은 무거운 일은 되도록 함께 돌리지 않는다.
- 전체 실행의 부하에서 아래 시험이 가끔 실패하고, 그 파일만 다시 돌리면 통과한다. 바꾼 코드가 닿지 않는 실패면 그 파일을 단독으로 다시 돌려 비교한다.
  - `app/test/flow/pr-auto.test.ts`의 닫힌 PR 시험: PR을 다시 연 직후 가짜 gh의 `gh pr view`가 종료 코드 1로 끝나 push가 "PR 상태를 읽지 못해"로 거절됨
  - `app/test/flow/control.test.ts`: 단언 실패 없이 vitest worker가 exit code 3221225477(0xC0000005)로 죽어 "Worker exited unexpectedly"로 전체가 종료 코드 1이 됨

## 바뀐 이력
- 2026-10-06 처음 남김 (Work w-20261006-001)
- 2026-10-07 전체 시험 시간과 부하에서 가끔 실패하는 흐름 시험을 더함 (Work w-20261006-003)
- 2026-10-07 Git Bash의 명령 치환에서 CR 수를 잘못 세는 것을 더함 (Work w-20261007-001)
- 2026-10-21 되감기를 없애며(D418) 그 흐름 시험을 뺌
- 2026-10-24 파일 하나만 돌리기 전의 contracts, `sed -i`의 CR, control.test.ts의 worker 충돌을 더하고 전체 시험 시간을 22~28분으로 고침 (Work w-20261024-001)
