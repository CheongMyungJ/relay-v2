## 재현
- 재현 절차: `npm run test:ci`를 반복 실행 (`for i in $(seq 1 6); do npm run test:ci; done`)
- 결과: 재현됨
- 기대: `ci/archive.test.js` 통과, 보관소에 임시 파일 없이 각 보고서의 올바른 내용
- 실제: 6회 중 4회 실패. `ENOENT: 파일이 없습니다: reports/2026-09/.xxxx.tmp`, `report-8 보관본의 고객사가 다르다: wayne (wonka여야 함)`

## 원인
- 원인: `saveReport`가 임시 파일 이름을 `.${stamp(now())}.tmp`(밀리초 시각)로만 만들어, 같은 밀리초에 시작한 동시 저장들이 같은 임시 파일을 쓴다. 한쪽이 rename으로 옮기면 다른 쪽 rename은 ENOENT가 나고, 덮어쓴 쪽은 다른 고객사 내용이 제 이름으로 남는다.
- 근거: `src/store/report-archive.js:23`. 지연이 0인 `npm test`는 저장이 겹치지 않아 가려지고 지연이 있는 CI에서만 겹친다. 수정 뒤 `ci/archive.test.js` 40회 연속 통과, 시각을 고정한 단위 시험이 수정 전 같은 ENOENT로 실패.
- 사람 추정 판정: 없음
- 기각한 가설: 시험 쪽 문제(재시도·시간 제한 필요) — 정책상 하지 않고, 원인이 제품 코드의 이름 충돌로 확인됨

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름에 reportId를 넣어 `.${reportId}-${stamp}.tmp`로 고유하게 했다 (점으로 시작하므로 `listReports`의 제외 규칙은 그대로).
- test/archive.test.js — 재현 시험 추가 (기존 시험은 바꾸지 않음).

## 재현 테스트
- 위치: test/archive.test.js `보관소: 같은 시각에 동시에 저장해도 임시 파일이 겹치지 않는다`
- 수정 전: 실패 (`npm test` → fail 1, `ENOENT: ... .muovznk0.tmp`)
- 수정 후: 통과 (`npm test` → pass 63, fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci`(반복), `node --test ci/archive.test.js` 40회
- 결과: `npm test` 통과. archive 40회 모두 통과. `npm run test:ci` 전체는 가끔 `ci/batch.test.js`(report-6이 job-5로 붙음)에서 실패.
- 실패 항목: `ci/batch.test.js`는 기준 커밋에서도 실패 (20회 중 6회). 비목표라 손대지 않음.
