## 재현
- 재현 절차: `for i in $(seq 20); do node --test ci/archive.test.js >/dev/null 2>&1 && echo -n "P " || echo -n "F "; done`
- 결과: 재현됨
- 기대: 20회 모두 통과
- 실제: 20회 중 11회 실패 (`ENOENT: 파일이 없습니다: reports/2026-09/.<이름>.tmp`)

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`로만 만들어, 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 쓴다. 한쪽이 rename하면 다른 쪽 rename은 ENOENT로 실패하고, 겹쳐 쓰면 다른 고객사 내용(wayne, stark)이 보관본에 들어간다.
- 근거: `src/store/report-archive.js:23` 이름에 보고서별 값이 없음. 시각을 고정하고 4개를 동시에 저장하는 시험이 수정 전 같은 ENOENT로 실패하고 수정 후 통과. 수정 후 `ci/archive.test.js` 30회 모두 통과. 로컬 `npm test`는 지연이 없어 저장이 겹치지 않아 통과한다.
- 사람 추정 판정: 없음
- 기각한 가설: `runPool` 결과 순서(`src/runner/pool.js`가 끝난 순서로 push) — 이 시험의 증상(ENOENT, 고객사 뒤바뀜)은 임시 파일 충돌만으로 설명되고, 수정 뒤 20회 이상 통과해 원인이 아님. 순서 문제는 `ci/batch.test.js` 쪽(범위 밖)

## 변경 요약
- `src/store/report-archive.js` — 임시 파일 이름에 `reportId`를 넣음(`.${stamp(now())}-${reportId}.tmp`). 접두 `.`와 접미 `.tmp`는 `listReports`/`strayTemps`가 쓰므로 유지.
- `test/archive.test.js` — 같은 시각 동시 저장 시험 추가(기존 시험은 바꾸지 않음).

## 재현 테스트
- 위치: `test/archive.test.js` "보고서 보관: 같은 시각에 동시에 저장해도 서로 겹치지 않는다"
- 수정 전: 실패 (`node --test test/archive.test.js` → ENOENT, pass 9 / fail 1)
- 수정 후: 통과 (같은 명령 → pass 10 / fail 0)

## 테스트 실행
- 명령: `npm run test:ci`, `node --test ci/archive.test.js` 30회 반복
- 결과: test:ci pass 67 / fail 0, archive 30회 실패 0
- 실패 항목: 없음
