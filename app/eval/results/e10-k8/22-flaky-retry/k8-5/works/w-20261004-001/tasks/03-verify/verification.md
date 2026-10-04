## 리뷰 지적
1. [차단] src/store/report-archive.js:23 — `saveReport`의 임시 파일 이름이 `.${stamp(now())}.tmp`라 같은 ms에 시작한 동시 저장끼리 겹친다. 한쪽이 rename하면 다른 쪽은 ENOENT로 실패하고, 겹쳐 쓰면 보관본에 다른 고객사 내용이 들어간다. `ci/archive.test.js`가 `npm run test:ci`에서 간헐 실패(검증 중 4회 중 3회, 단독 20회 중 5회). 제안: 임시 이름에 reportId 포함.

## 반영
- 1 — 임시 이름을 `.${reportId}.${stamp(now())}.tmp`로 변경(접두 `.`와 접미 `.tmp` 유지). 커밋 ac60b81. 재현 절차는 바뀌지 않음. 이후 `ci/archive.test.js` 30회 실패 0, `ci/batch.test.js` 30회 실패 0, `npm run test:ci` 10회 실패 0, 마지막 실행 pass 67 / fail 0, `npm test` pass 63 / fail 0.

## 반영하지 않은 지적
- 없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행해 `ci/batch.test.js`가 간헐적으로 실패하는 현상)가 더 이상 실패하지 않는다 | 통과 | `for i in $(seq 30); do node --test ci/batch.test.js; done` 30회 중 실패 0. (fix.md는 수정 전 30회 중 6회 실패. 이번에 수정 전은 다시 돌리지 않음) |
| `npm run test:ci`가 통과한다 | 통과 | 지적 1 반영 후 10회 연속 통과, pass 67 / fail 0. 반영 전에는 `ci/archive.test.js` 때문에 4회 중 3회 실패했음(fix.md의 통과는 우연) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 시험 변경 없음. `test/pool.test.js`에 시험 1개 추가만 있음 |
| `ci/batch.test.js`를 여러 번(예: 30회) 연속 실행해도 한 번도 실패하지 않는다 | 통과 | 30회 실행, 통과 30 / 실패 0 |
| 반복 실행의 횟수와 통과/실패 결과를 검증 보고서에 남긴다 | 통과 | 이 표와 `## 반영`: batch 30회 0실패, archive 30회 0실패, test:ci 10회 0실패 |
| 병렬 실행(동시 4개)이 유지된다 | 통과 | `src/config.js` 기본 `concurrency: 4`, `runPool`은 `Promise.all` 묶음 구조 그대로(diff 확인). 동시 4개를 직접 관측하는 시험은 없음 |
| 수정은 시험이 아니라 `src/`의 원인 코드에 있고, 재시도·skip·시간 제한 증가가 없다 | 통과 | 수정 파일은 `src/runner/pool.js`, `src/store/report-archive.js`. 시험 변경은 시험 추가뿐이며 재시도·skip·타임아웃 변경 없음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 순서 보존 시험 1개 추가, 기존 시험은 그대로. 수정 전 코드에서 실패하는 시험임(fix.md)

## 남은 위험
- `runPool`을 쓰는 곳은 `runner.js` 하나뿐이지만, 이후 완료 순서를 가정하는 코드가 생기면 같은 문제가 난다.
- 임시 이름이 reportId마다 달라졌으므로 같은 reportId를 동시에 두 번 저장하면 여전히 겹친다(현재 배치에서는 없음).
- 동시 저장 겹침을 직접 잡는 단위 시험은 추가하지 않았다. `ci/archive.test.js`의 반복 실행이 잡는다.
- 간헐 버그라 반복 횟수(30회)가 통과를 보장하지는 않는다.
