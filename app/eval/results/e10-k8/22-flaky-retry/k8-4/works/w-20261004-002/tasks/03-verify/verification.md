## 리뷰 지적
1. [사소] src/store/report-archive.js:23 — 같은 reportId를 같은 ms에 동시에 두 번 저장하면 임시 파일 이름이 다시 겹친다. 현재 배치는 작업마다 reportId가 달라 해당 없음. 필요하면 호출마다 증가하는 카운터를 이름에 더한다.

(그 밖에 확인한 것: 수정은 원인(`saveReport`의 시각만 쓴 임시 파일 이름)을 직접 고쳤고 증상만 가린 것이 아니다. 보관본 이름과 `listReports`/`strayTemps` 필터는 그대로다. 병렬 실행과 `ci/` 시험은 건드리지 않았다. 재현 테스트는 시각을 고정하고 4개를 동시에 저장해 수정 전 ENOENT로 실패한다고 fix.md에 있다. 불필요한 변경은 없다.)

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다 | 통과 (사람 판단: 보관소 범위) | `npm run test:ci` 35회(20회+15회) 중 보관소 실패(ENOENT, 다른 고객사 보관본) 0회. 전체 통과는 20회 중 13회, 15회 중 12회이고, 실패는 모두 비목표인 `ci/batch.test.js`의 `expected report-N to belong to job-N`. |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 63, pass 63, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f146495 --stat`: 바뀐 테스트 파일은 `test/archive.test.js` 하나이고 테스트 1개를 추가만 했다. `ci/` 변경 없음. |
| `npm run test:ci`를 여러 번 반복 실행한 결과(실행 횟수와 통과 횟수)가 모두 통과로 제시된다 | 통과 (사람 판단: 보관소 범위) | `ci/archive.test.js` 단독 30회 중 30회 통과. `npm run test:ci` 전체는 위 횟수대로 보관소 실패 0회, 전체 통과 25/35이며 실패는 모두 batch. |
| `ci/archive.test.js`에 재시도 추가, skip, 시간 제한 늘리기를 하지 않는다 | 통과 | `git diff f146495 --stat -- ci` 출력 없음 (`ci/` 변경 없음) |
| 배치의 병렬 실행(동시 4개)이 그대로 유지된다 | 통과 | 변경은 `src/store/report-archive.js` 임시 파일 이름 한 줄뿐. `src/config.js:4`의 `concurrency: 4`와 `src/runner/pool.js`는 변경 없음. |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 재현 테스트 1개 추가만 있고 기존 테스트는 바뀌지 않았다.

## 남은 위험
- `npm run test:ci` 전체는 `ci/batch.test.js` 순서 문제로 가끔 실패한다(이번 검증 35회 중 9회). 비목표이며 따로 리뷰 중인 Work에서 고친다.
- 같은 reportId를 같은 ms에 동시 저장하면 임시 파일 이름이 겹친다(지적 1). 현재 호출 경로에는 없다.
- 앞 Work(w-20261004-001)에서 같은 임시 파일 이름을 고쳤을 수 있음, 머지 대기. 머지 때 충돌 가능.
