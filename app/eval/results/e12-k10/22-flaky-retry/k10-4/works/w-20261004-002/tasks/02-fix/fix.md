## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (수정 전 코드, 6회 중 4회 실패)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 두 시험 모두 통과
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.mutukeec.tmp`, `report-5 보관본의 고객사가 다르다: stark (hooli여야 함)`

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`, 곧 밀리초 시각만으로 만든다. 동시 4개로 도는 작업이 같은 밀리초에 저장을 시작하면 같은 임시 경로에 쓰고 옮기게 되어, 한 작업이 다른 작업의 내용을 제 이름으로 옮기고(다른 고객사 보관본), 늦게 옮기는 쪽은 이미 사라진 임시 파일 때문에 ENOENT가 난다.
- 근거: `src/store/report-archive.js:23`. 실패 로그의 임시 이름이 하나(`.mutukeec.tmp`)이고 실패 시험의 보관본이 다른 작업 고객사였음. 시각을 고정하고 4개를 동시에 저장하는 시험이 수정 전 실패, 이름에 reportId를 넣자 통과. 시각은 ms 단위라 조회·저장 지연의 jitter에 따라 겹치거나 안 겹쳐 간헐적임.
- 사람 추정 판정: 없음
- 기각한 가설: runPool 결과 순서(앞 Work의 원인) — 이 시험은 보관소 내용과 임시 파일 오류가 증상이고 결과 순서와 무관. 순서를 고치지 않은 상태에서 20회 통과함. batch 시험은 비목표.

## 변경 요약
- `src/store/report-archive.js` — 임시 파일 이름에 reportId를 넣어 동시 저장 때 겹치지 않게 함
- `test/archive.test.js` — 회귀 시험 추가 (기존 시험은 바꾸지 않음)

## 재현 테스트
- 위치: `test/archive.test.js` '같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다'
- 수정 전: 실패 (`node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (같은 명령 → pass 10, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`, `ci/archive.test.js` 20회 연속 (`node --test ci/archive.test.js`)
- 결과: `npm test` pass 63 fail 0, `npm run test:ci` pass 67 fail 0, archive 20회 모두 fail 0 (20/20 통과)
- 실패 항목: 없음. 재시도, skip, 시간 제한·지연 변경 없음, 동시 4개 유지
