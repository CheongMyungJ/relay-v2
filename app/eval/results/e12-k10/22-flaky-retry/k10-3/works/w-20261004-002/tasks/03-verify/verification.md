## 리뷰 지적
1. [사소] test/archive.test.js:97 — 재현 시험이 서로 다른 reportId 4개만 저장해, 호출 순번(`tmpSeq`)이 막는 "같은 reportId 동시 저장"은 검증하지 못한다. 같은 reportId를 동시에 저장하는 시험을 추가하자.

(리뷰 결과: 수정은 `fix.md`의 원인(시각만으로 만든 임시 이름의 충돌)을 src에서 고치며 증상만 가리지 않는다. 재시도·skip·시간 제한 변경 없음. 비목표(batch)와 병렬 실행은 건드리지 않았다.)

## 반영
- 1 — `test/archive.test.js`에 같은 reportId 4개 동시 저장 시험 추가. 순번 제거 시 이 시험이 실패함을 확인. 커밋 9d2a5e9. `npm test` 64/64 통과. 같은 커밋에서 `docs/knowledge/runner/concurrency-order-pitfalls.md`를 갱신(팀 지식).

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`, 특히 `ci/archive.test.js` 반복 실행)가 더 이상 실패하지 않는다 | 통과 | `node --test ci/archive.test.js` 20회 중 20 통과. `npm run test:ci`의 실패 3/10회는 모두 `ci/batch.test.js`(archive 아님) |
| `npm test`와 `npm run test:ci`가 통과한다 | 실패 | `npm test` 64/64 통과. `npm run test:ci` 10회 중 7 통과, 3 실패 — 모두 `ci/batch.test.js` "밤 배치: 보고서마다 제 작업과 고객사가 붙는다". 기준 커밋에서도 실패하는 비목표(별도 Work 수정 중). 사람이 완료 화면으로 진행하기로 함 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff d2c6ce3 -- test`: 시험 2개 추가만 있고 기존 시험 변경·삭제 없음 |
| `node --test ci/archive.test.js`를 여러 번 반복 실행해도 한 번도 실패하지 않는다 | 통과 | 20회 중 통과 20, 실패 0 (반영 전 20/0, 반영 후 20/0) |
| 수정이 `ci/archive.test.js`가 아니라 원인이 되는 src 코드에 들어간다 | 통과 | 수정은 `src/store/report-archive.js`. `ci/` 변경 없음 |
| 배치 병렬 실행(동시 4개)은 그대로 유지되고, 순차 실행으로 되돌리지 않는다 | 통과 | 변경 파일에 `src/runner/` 없음(`git diff d2c6ce3 --stat`). `runPool` 호출 유지 |
| 수정 후 `npm run test:ci`와 `node --test ci/archive.test.js`를 여러 번 반복 실행한 결과(실행 횟수와 통과/실패 수)를 보고한다 | 통과 | 이 문서와 handoff에 보고: archive 20회 20/0, `npm run test:ci` 10회 7/3(실패는 batch만) |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 시험 2개 추가(동시 저장 재현 2건)만 있고 기존 시험은 그대로

## 남은 위험
- `npm run test:ci`는 `ci/batch.test.js` 간헐 실패(순서 문제)로 여전히 실패할 수 있다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- `tmpSeq`는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 폴더에 같은 reportId를 같은 ms에 저장하면 겹칠 수 있다(현재 구조에서는 해당 없음).
