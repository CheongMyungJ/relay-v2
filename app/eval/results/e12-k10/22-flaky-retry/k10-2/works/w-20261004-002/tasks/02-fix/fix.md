## 재현
- 재현 절차: `for i in $(seq 10); do node --test ci/archive.test.js; done` (워크트리 루트)
- 결과: 재현됨
- 기대: 매번 2개 통과
- 실제: 10회 중 6회 실패 (`pass 0 / fail 2`). 로그는 `ENOENT: 파일이 없습니다: reports/2026-09/.<임시이름>.tmp`

## 원인
- 원인: `saveReport`의 임시 파일 이름이 시각(`stamp(now())`)만 써서, 같은 밀리초에 동시에 저장하는 서로 다른 보고서가 같은 임시 파일을 공유한다. 한쪽이 rename으로 옮기면 다른 쪽 rename은 ENOENT가 나고, 덮어쓴 내용이 옮겨지면 다른 고객사 보관본이 된다.
- 근거: src/store/report-archive.js:24 임시 이름에 reportId 없음. ci 시험은 8개 보고서를 풀로 동시에 저장한다. 로컬 `npm test`는 지연이 없어 겹치지 않는다. 시계를 고정하고 4개를 동시에 저장하는 새 시험이 수정 전 같은 ENOENT로 실패하고, 이름에 reportId를 넣자 통과했다. 수정 뒤 ci/archive.test.js 25회 연속 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 없음 (팀 지식 report-temp-file-name.md의 내용은 이 코드에서 직접 확인했다. 기준 브랜치에는 그 수정이 없다)

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.<reportId>-<stamp>.tmp`로 바꿔 보고서마다 다르게 했다. 보관본 경로와 `.`로 시작하는 임시 파일 규칙은 그대로다.
- test/archive-concurrent.test.js (새 파일) — 재현 시험 추가. 기존 시험은 바꾸지 않았다.

## 재현 테스트
- 위치: test/archive-concurrent.test.js
- 수정 전: 실패 (`node --test test/archive-concurrent.test.js` → ENOENT ... .muovznk0.tmp, pass 0)
- 수정 후: 통과 (같은 명령 → pass 1, fail 0)

## 테스트 실행
- 명령: `npm run test:ci`, 그리고 `node --test ci/archive.test.js` 25회 반복
- 결과: test:ci는 pass 67 / fail 0. archive 반복 25회 모두 fail 0
- 실패 항목: 없음
