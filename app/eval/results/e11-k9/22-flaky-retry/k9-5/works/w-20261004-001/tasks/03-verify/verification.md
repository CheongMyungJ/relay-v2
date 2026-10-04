## 리뷰 지적
없음

(검토 내용: 변경은 `src/runner/pool.js`의 `results.push`를 `results[start + i]`로 바꾼 것으로 fix.md의 원인(완료 순서 push)을 직접 고친다. `done` 카운터를 따로 두어 `onChunk` 의미가 그대로다. 묶음 단위 동시 4개 실행은 그대로다. 호출자는 `runner.js` 하나이며 `collectResults`가 인덱스 짝짓기를 쓰므로 맞다. 불필요한 변경 없음. 재현 테스트는 지연 [30,5,20,1,10]으로 순서 뒤바뀜을 실제로 잡는다.)

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `for i in $(seq 20); do node --test ci/batch.test.js; done` 20회 모두 통과(실패 0). 수정 전에는 10회 중 5회 실패(fix.md) |
| `npm test`와 `npm run test:ci`가 통과한다 | 통과 | `npm test` pass 63 / fail 0, `npm run test:ci` pass 67 / fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 테스트 변경은 test/pool.test.js에 케이스 13줄 추가뿐, 삭제·수정 없음 |
| `ci/batch.test.js`를 여러 번 반복 실행(예: 20회 연속)해도 실패하지 않는다 | 통과 | 위 20회 반복에서 실패 0 |
| 배치가 여전히 동시 4개로 병렬 실행된다(순차 실행으로 되돌리지 않는다) | 통과 | 기본값 `concurrency: 4`(src/config.js:4), 9개 작업을 concurrency 4로 돌려 최대 동시 실행 수 4 확인 |
| 수정이 시험의 재시도, skip, 시간 제한 증가에 의존하지 않는다 | 통과 | diff는 pool.js와 pool.test.js뿐이고 ci/batch.test.js는 바뀌지 않음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 기존 케이스는 그대로이고 입력 순서 보존 케이스 하나만 추가

## 남은 위험
- 완료 순서에 의존하던 호출자가 있으면 영향을 받는다. 레포 안 호출자는 runner.js 하나이고 인덱스 짝짓기를 쓴다.
- 묶음 단위 병렬이라 한 묶음 안의 느린 작업이 다음 묶음을 막는 처리량 한계는 그대로다(이번 범위 아님).
