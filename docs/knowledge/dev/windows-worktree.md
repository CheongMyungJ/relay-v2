---
kind: pitfall
source: investigation
---
# Windows의 Work worktree에서 검사를 돌릴 때

## 내용
- 새 worktree에는 `app/node_modules`가 없다. `npm ci` 뒤 Electron 바이너리가 없으면 `node node_modules/electron/install.js`로 받는다.
- worktree가 `core.autocrlf=true`라 `npm run format:check`가 손대지 않은 파일까지 CRLF로 잡는다. 바꾼 파일만 `npx prettier --check --end-of-line auto <파일들>`로 본다.

## 바뀐 이력
- 2026-10-06 처음 남김 (Work w-20261006-001)
