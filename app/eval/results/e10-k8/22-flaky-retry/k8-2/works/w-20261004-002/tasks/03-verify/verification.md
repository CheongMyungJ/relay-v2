## 리뷰 지적
1. [사소] test/pool.test.js:40 — `async (ms, ) =>`에 불필요한 쉼표가 있다. 제거를 제안한다.
2. [사소] src/store/report-archive.js:6 — `tempSeq`는 프로세스 내 카운터라 여러 프로세스가 같은 보관소에 동시에 쓰면 reportId와 시각이 같을 때 겹칠 수 있다. 현재 배치는 한 프로세스의 병렬 4개이고 범위 밖이라 코드 변경 없이 위험으로 남기는 것을 제안한다.

원인(임시 파일 이름 충돌, runPool 완료 순서 저장)을 고쳤고 증상만 가린 것이 아니다. 병렬 4개 유지, 재시도/skip/시간 늘리기 없음, `ci/` 변경 없음, `batch.test.js` 미접촉. 그 밖의 지적은 없다.

## 반영
- 1 — 쉼표 제거, 커밋 06ddb09. `npm test` pass 64 / fail 0, `npm run test:ci` 10회 반복 모두 통과(pass 68 / fail 0). 재현 절차는 바꾸지 않았다.
- 2 — 코드 변경 없음(제안이 위험으로 기록하는 것). `남은 위험`에 기록.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다 | 통과 | 기준 커밋(e5b39e7)에서 6회 중 2회 실패로 재현됨. 최종 코드에서 15회 + 10회 반복 모두 통과 |
| `npm run test:ci`가 통과한다 (`npm test`도 통과한다) | 통과 | `npm run test:ci` pass 68 fail 0, `npm test` pass 64 fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff e5b39e7`: 테스트 파일은 추가만 있고 기존 줄 삭제/수정 없음 |
| `ci/archive.test.js`에 재시도, skip, 시간 제한 늘리기가 추가되지 않는다 | 통과 | `git diff e5b39e7 -- ci`가 비어 있음 |
| 배치 병렬 동시 실행 수(4개)가 그대로다 | 통과 | `src/config.js:4` `concurrency: 4` 변경 없음(diff에 config 없음) |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 재현 테스트 1개 추가만 있고 기존 테스트는 그대로
- test/pool.test.js — 약화 아님 — 재현 테스트 1개 추가(이후 쉼표만 정리), 기존 테스트는 그대로

## 남은 위험
- `tempSeq`는 프로세스 내 카운터라 여러 프로세스가 같은 보관소에 동시에 쓰면 겹칠 수 있다.
- 같은 원인은 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 src/runner/pool.js, src/store/report-archive.js에서 충돌 가능.
