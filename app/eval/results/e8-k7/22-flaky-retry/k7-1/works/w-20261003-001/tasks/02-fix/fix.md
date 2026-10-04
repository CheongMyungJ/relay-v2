## 재현
- 재현 절차: `npm run test:ci`를 8번 반복 (`for i in 1..8; do npm run test:ci; done`)
- 결과: 재현됨 (8번 중 5번 실패)
- 기대: report-N이 job-N에 붙는다
- 실제: `expected report-4 to belong to job-4, got job-3` 등

## 원인
- 원인: (1) `runPool`이 결과를 끝난 순서로 `push`하는데 `collectResults`는 인덱스로 작업과 짝짓는다. 조회 지연이 흔들리면 순서가 바뀌어 report가 다른 job에 붙는다. (2) 수정 뒤에도 `ci/archive.test.js`가 간헐 실패했다. `saveReport`의 임시 파일 이름이 `stamp(now())`(ms)뿐이라, 같은 ms에 같은 폴더에 저장하는 작업끼리 이름이 겹쳐 서로 덮어쓰거나 rename이 ENOENT가 된다(`ENOENT ... .musbw31x.tmp`, 보관본 고객사 불일치). 같은 증상(보고서와 작업 불일치) 계열이라 함께 고쳤다.
- 근거: `src/runner/pool.js` 원래 `results.push`, `src/collect/collector.js` `outcomes[i]`. 수정 전 8번 중 5번 실패, 수정 뒤 `ci/batch.test.js`는 통과했지만 archive 실패가 남았고, 임시 이름 수정 뒤 30번 연속 `test:ci` 통과. 임시 수정을 되돌리면 새 시험이 실패함(실험함).
- 사람 추정 판정: 추정(실패 로그, 재실행하면 통과) — 판단 불가가 아니라 관찰과 일치: 간헐 실패 양상이 지연 순서 의존으로 설명됨
- 기각한 가설: 재시도/타임아웃 문제 — 로그에 재시도 없음(attempts=1), 원인은 순서 뒤섞임과 이름 충돌

## 변경 요약
- src/runner/pool.js — 결과를 `results[start + i]`에 넣어 입력 순서를 유지, `done`은 별도 카운터
- src/store/report-archive.js — 임시 파일 이름에 reportId 추가
- test/pool.test.js, test/archive.test.js — 재현 시험 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: `test/pool.test.js` '결과는 완료 순서가 아니라 입력 순서로…', `test/archive.test.js` '같은 시각에 여러 보고서를…'
- 수정 전: 실패 (`node --test test/pool.test.js` → fail 1, `node --test test/archive.test.js` → fail 1)
- 수정 후: 통과 (각각 fail 0)

## 테스트 실행
- 명령: `npm run test:ci` 30회 반복, `npm test`
- 결과: test:ci 30회 모두 fail 0, npm test pass 64 fail 0
- 실패 항목: 없음 (수정 전 실패는 기준 커밋에서도 발생)
