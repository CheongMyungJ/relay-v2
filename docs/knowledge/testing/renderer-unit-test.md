---
kind: fact
source: investigation
---
# 렌더러의 순수 모듈을 [단위]에서 시험할 때

## 내용
- [단위] 시험이 import하는 렌더러 파일(`app/src/renderer/src/*.ts`)은 `app/tsconfig.node.json`의 `include`에 하나씩 더한다(지금 `renderMarkdown.ts`, `opened.ts`, `sidebar.ts`). 시험 폴더는 node 쪽 프로젝트이고 설정이 `composite`라, 목록에 없는 파일을 import하면 `tsc -b`가 거절한다.
- 그 파일은 node 설정(DOM lib 없음)으로도 검사된다. `localStorage`는 `@types/node`에 있어 타입은 통과하지만 [단위]는 node에서 돌아 값이 없다. `vi.stubGlobal('localStorage', …)`로 바꿔 시험하고 `vi.unstubAllGlobals()`로 되돌린다(`app/test/unit/sidebar.test.ts`).

## 바뀐 이력
- 2026-10-07 처음 남김 (Work w-20261006-003)
