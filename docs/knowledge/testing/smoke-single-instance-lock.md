---
kind: pitfall
source: investigation
---
# relay 앱 안의 세션에서는 [스모크]가 단일 인스턴스 잠금으로 바로 끝난다

## 내용
- relay 앱이 켜진 채 그 앱의 task 세션에서 `npx playwright test test/smoke/...`를 돌리면 `electron.launch: Process failed to launch` (exitCode 0)로 바로 끝난다. 기존 `theme.spec.ts`도 같다.
- `APPDATA`를 바꿔도 안 된다. launch 인자에 `--user-data-dir=<임시 디렉터리>`를 주면 뜬다. 확인할 때만 임시로 넣고, 커밋하는 스모크는 다른 스모크와 같은 모양으로 둔다.

## 바뀐 이력
- 2026-10-06 처음 남김 (Work w-20261006-001)
