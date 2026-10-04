## 재현
- 재현 절차: `for i in $(seq 1 15); do node --test ci/archive.test.js; done`
- 결과: 재현됨 (15회 중 6회 실패)
- 기대: 두 시험 모두 통과
- 실제: `ENOENT: 파일이 없습니다: reports/2026-09/.musdtkdc.tmp`, `report-6 보관본의 고객사가 다르다: hooli (stark여야 함)` 등

## 원인
- 원인: `saveReport`의 임시 파일 이름이 ms 시각(`stamp(now())`)뿐이라, 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 쓴다. 한쪽 rename이 파일을 옮기면 다른 쪽 rename은 ENOENT, 내용도 뒤바뀐다.
- 근거: `src/store/report-archive.js` 임시 이름 줄. 실패 메시지의 `.tmp` 이름에 reportId가 없음. 시각을 고정하고 4개를 동시에 저장하는 시험이 수정 전 같은 ENOENT로 실패, 수정 후 통과. 수정 후 `ci/archive.test.js` 30회 반복 모두 통과. 로컬 `npm test`는 지연이 없어 겹치지 않아 통과한다.
- 사람 추정 판정: 로컬 npm test는 통과하고 CI에서만 가끔 실패 — 맞음 — 지연이 있어야 동시 저장이 같은 ms에 겹친다.
- 기각한 가설: runPool 완료 순서 문제가 원인이라는 가설 — archive 시험의 보관본 내용은 saveReport에 넘긴 payload에서 오고 순서와 무관하다. (`runPool`의 완료 순서 결과 수집은 별개 문제로 batch.test.js 쪽이며 비목표라 건드리지 않음)

## 변경 요약
- src/store/report-archive.js — 임시 파일 이름을 `.<reportId>.<stamp>.tmp`로 바꿔 보고서마다 고유하게 함 (`.`로 시작, `.tmp`로 끝나는 규칙은 유지)
- test/archive.test.js — 동시 저장 재현 시험 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/archive.test.js '보관소: 같은 시각에 동시에 저장해도 보고서마다 제 내용이 남는다'
- 수정 전: 실패 (`npm test` → ENOENT ... .tmp, pass 62 / fail 1)
- 수정 후: 통과 (`npm test` → pass 63 / fail 0)

## 테스트 실행
- 명령: `npm run test:ci`, `npm test`, `ci/archive.test.js` 30회 반복
- 결과: test:ci pass 67 / fail 0, npm test pass 63 / fail 0, 반복 실패 0회
- 실패 항목: 없음
