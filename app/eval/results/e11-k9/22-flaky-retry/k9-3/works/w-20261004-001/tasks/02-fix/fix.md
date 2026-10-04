## 재현
- 재현 절차: `npm run test:ci`를 10번 반복 실행 (`for i in $(seq 1 10); do npm run test:ci | grep -E "^# (pass|fail)"; done`)
- 결과: 재현됨
- 기대: 10번 모두 fail 0
- 실제: 기준 커밋에서 10번 중 7번 실패 (fail 1~3). 실패 시험은 `ci/batch.test.js`의 "보고서마다 제 작업과 고객사가 붙는다"(`expected report-N to belong to job-N, got job-M`)였고, 수정 중에 `ci/archive.test.js`("보고서가 모두 보관소에 저장된다", "보관본마다 제 고객사와 합계")의 간헐적 실패도 확인했다.

## 원인
- 원인: 서로 다른 두 결함이 있었다. (1) `runPool`이 결과를 끝난 순서로 `push`하는데, `collectResults`는 `outcomes[i]`를 `jobs[i]`와 인덱스로 짝짓는다. 조회 지연 jitter 때문에 같은 묶음 안에서 끝나는 순서가 바뀌면 보고서가 다른 작업에 붙는다. (2) `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`라 같은 ms에 동시에 저장하는 작업들이 같은 임시 파일을 쓰고 옮겨, 보관본이 덮어써지거나 `rename`이 ENOENT로 실패한다.
- 근거: `src/runner/pool.js`(수정 전 `results.push`), `src/collect/collector.js` `collectResults`(`outcomes[i]`). `src/store/report-archive.js:23` 임시 파일 이름, 동시 4개 실행. 실험: pool만 고친 뒤 `test:ci`가 30번 중 14번만 통과, 실패는 모두 archive 시험이었다. 둘 다 고친 뒤 50/50 통과. 각 수정을 되돌렸을 때 재현 테스트가 실패함을 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도/시간 제한/병렬 수 문제 — 실패가 지연 순서와 이름 충돌로 설명되고, 병렬 4개는 유지한 채 해결됨

## 변경 요약
- `src/runner/pool.js` — 결과를 `results[start + i]`에 넣어 입력 순서를 유지. 진행 알림의 `done`은 완료 카운터로 계산.
- `src/store/report-archive.js` — 임시 파일 이름에 reportId를 포함해 동시 저장 시 충돌 방지.
- `test/pool.test.js`, `test/archive.test.js` — 재현 테스트 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: `test/pool.test.js` "결과는 끝난 순서가 아니라 입력 순서다", `test/archive.test.js` "보고서 보관: 같은 시각에 동시에 저장해도 서로 덮어쓰지 않는다" (시계 고정으로 결정적)
- 수정 전: 실패 (각 수정만 되돌리고 `npm test`: pool 되돌림 시 fail 1, archive 되돌림 시 fail 1)
- 수정 후: 통과 (`npm test` pass 64 / fail 0)

## 테스트 실행
- 명령: `npm test`, `npm run test:ci` 50회 반복
- 결과: `npm test` 통과(64). `npm run test:ci` 50회 중 50회 통과.
- 실패 항목: 없음 (수정 전 실패는 기준 커밋에서도 간헐적으로 발생)
