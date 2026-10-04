## 재현
- 재현 절차: 작업 디렉터리에서 `for i in $(seq 8); do npm run test:ci; done` (간헐이라 반복 필요)
- 결과: 재현됨
- 기대: 매번 통과, report-N은 job-N
- 실제: 8회 중 3회 실패. `expected report-2 to belong to job-2, got job-1`(ci/batch.test.js). 그와 별개로 ci/archive.test.js `보고서가 모두 보관소에 저장된다`도 간헐 실패(`ENOENT: reports/2026-09/.<stamp>.tmp`).

## 원인
- 원인: (1) `runPool`이 결과를 작업이 끝난 순서로 `push`하는데 `collectResults`는 인덱스로 작업과 짝지어, 조회 지연 순서가 바뀌면 report가 다른 job에 붙는다. (2) `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`(ms 단위)뿐이라 같은 ms에 동시 저장하는 두 작업이 같은 임시 파일을 쓰고 rename해, 뒤 작업이 ENOENT로 실패한다.
- 근거: src/runner/pool.js `results.push(result)`(완료 순서), src/collect/collector.js `outcomes[i]` 인덱스 짝짓기. 지연이 없는 로컬 `npm test`는 완료 순서가 입력 순서와 같아 늘 통과. 수정 후 20회 연속 통과로 확인. 임시 파일 충돌은 실패 로그의 `.muscr7kp.tmp` ENOENT와 report-archive.js의 이름 규칙으로 설명됨.
- 사람 추정 판정: 없음 (추가 의견은 재현 방법 안내뿐)
- 기각한 가설: 지연/타임아웃 문제 — 실패가 다른 job과 짝이 어긋나는 형태이고 시간 제한과 무관함

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 items 순서를 보장. 병렬(동시 4개)은 그대로.
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 동시 저장에서 겹치지 않게 함.
- test/pool.test.js, test/archive.test.js — 테스트 추가만 함(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/pool.test.js `결과는 끝난 순서가 아니라 items 순서다`, test/archive.test.js `같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다`
- 수정 전: 실패 (src를 되돌리고 `npm test` → not ok 10, not ok 31, fail 2)
- 수정 후: 통과 (`npm test` → pass 64, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 20회 반복
- 결과: `npm test` 64 통과. `npm run test:ci` 20/20 통과.
- 실패 항목: 없음 (기준 커밋에서는 test:ci가 8회 중 3회 실패했음을 확인)
