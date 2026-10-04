## 리뷰 지적
없음

(검토: 목표·비목표에 맞고, `runPool`을 호출하는 곳은 `src/runner/runner.js` 한 곳이며 동시 수는 설정값 그대로다. `collectResults`의 인덱스 짝짓기와 `runPool` 입력 순서 보장이 맞아 원인을 직접 해소한다. `done` 카운터로 `onChunk` 알림 값은 이전과 같다. 임시 파일은 `.`로 시작해 `listReports`에서 제외되고 `.tmp` 검사(`strayTemps`)와도 호환된다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 여러 번 반복 실행)가 더 이상 실패하지 않는다 | 통과 | 직접 30회 반복 실행해 30/30 `fail 0` (기준 커밋에서는 fix.md 기준 10번 중 7번 실패) |
| `npm run test:ci`가 통과한다 | 통과 | 위 30회 모두 통과 |
| `npm test`가 통과한다 | 통과 | `npm test`: pass 64 / fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff d3a83e8 --stat`: `ci/` 변경 없음, 테스트 파일 2개는 시험 추가만(삭제·수정 0줄) |
| `ci/batch.test.js`에 재시도, skip, 시간 제한 증가를 넣지 않는다 | 통과 | `ci/` 아래 기준 커밋 이후 변경 없음 |
| 배치 병렬 실행(동시 4개)은 유지하고, 순차 실행으로 되돌리지 않는다 | 통과 | `runner.js`가 `config.concurrency`를 `runPool`에 그대로 전달, `runPool`의 묶음 병렬(`Promise.all`) 구조 유지 |
| 고쳤다는 근거로 `npm run test:ci`를 여러 번 반복 실행한 결과(실행 횟수와 통과 횟수)가 기록되어 있다 | 통과 | `fix.md`: 50회 중 50회 통과, 이번 검증: 30회 중 30회 통과 |
| 원인이 코드 근거와 함께 설명되고, 수정이 그 원인을 직접 해소한다 | 통과 | `fix.md`에 `pool.js` `results.push`와 `collectResults`의 `outcomes[i]`, `report-archive.js:24` 임시 파일 이름이 근거로 있고, 수정이 각각 입력 순서 저장과 reportId 포함 이름으로 직접 해소. 각 수정을 되돌리면 재현 테스트가 실패함을 `fix.md`가 기록 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험 변경 없음
- test/archive.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험 변경 없음

## 남은 위험
- 임시 파일 이름 형식이 `.<reportId>.<stamp>.tmp`로 바뀌었다. 정산팀이 이름에 의존하면 영향이 있다(`listReports`는 `.`로 시작하는 파일 제외).
- 같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않는다.
