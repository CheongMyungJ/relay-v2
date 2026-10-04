## 리뷰 지적
없음

(검토한 것: 원인(`runPool`의 완료 순서 push ↔ `collectResults`의 인덱스 짝짓기)을 직접 고쳤고 증상만 가린 것이 아니다. `runPool` 호출부는 `src/runner/runner.js` 한 곳뿐이며 계약(입력 순서)과 맞다. 병렬 동시 4개 유지. `onChunk`의 `done`은 완료 개수로 이전 값과 같다. 불필요한 변경 없음.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`ci/batch.test.js`를 여러 번 반복 실행해도 실패하지 않는다) | 통과 | `node --test ci/batch.test.js` 20회 반복, 20회 통과. fix.md에서는 수정 전 10회 중 3회 실패(재현됨) |
| `npm test`, `npm run test:ci`가 통과한다 | 통과 | `npm test` 63 통과/0 실패, `npm run test:ci` 67 통과/0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b1aee9b`: 테스트 변경은 `test/pool.test.js`에 시험 1개 추가뿐, 삭제·수정 없음 |
| `ci/batch.test.js`를 연속 20회 반복 실행한 결과를 남기고 20회 모두 통과한다 | 통과 | 실행 20회, 통과 20회, 실패 0회 |
| 시험 쪽 재시도, skip, 시간 제한 증가 없이 통과한다 | 통과 | 변경은 `src/runner/pool.js`와 시험 추가뿐. `ci/batch.test.js`·`LATENCY` 미변경 |
| 실패 조건(완료 순서가 바뀌는 지연)을 결정적으로 재현하는 회귀 시험이 `npm test`에 추가된다 | 통과 | `test/pool.test.js` 새 시험(지연 [30,5,20,1,10]). 수정 전 `pool.js`로 되돌려 실행하면 pass 4/fail 1로 실패, 수정본은 `npm test`에서 통과 |

## 테스트 파일 변경
- `test/pool.test.js` — 약화 아님 — 기존 시험은 그대로 두고 회귀 시험 1개만 추가. 수정 전 코드에서 실제로 실패함을 확인

## 남은 위험
- `runPool`의 worker가 reject하면 이전과 같이 `Promise.all`이 즉시 reject하며 부분 결과는 버려진다(이번 변경 범위 밖, 동작 동일).
