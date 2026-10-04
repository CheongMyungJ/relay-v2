## 리뷰 지적
1. [차단] src/store/report-archive.js:23 — 임시 파일 이름이 `.${stamp(now())}.tmp`라 같은 ms에 시작한 동시 저장(동시 4개)이 같은 임시 파일을 공유해, 다른 고객사 보고서가 덮어써지거나 rename 실패(`failed: 1`)가 난다. `npm run test:ci`의 ci/archive.test.js가 반복 실행에서 약 절반 실패(fix 이후 코드에서 재현). 별개 원인이며 이번 Work의 `npm run test:ci` 통과 조건을 막는다. 제안: 임시 이름에 reportId를 넣고 결정적 시험을 추가.
2. [권장] test/pool.test.js — onChunk의 `done`을 index 대신 카운터로 바꾼 부분을 지연이 섞인 경우로 확인하는 시험이 없음. 제안: 완료 순서가 섞여도 묶음별 done이 맞는지 시험 추가.

## 반영
- 1 — 임시 이름을 `.${reportId}.${stamp}.tmp`로 변경, test/archive.test.js에 시계를 멈춰 같은 시각에 4개를 동시에 저장하는 시험 추가(수정 전 코드에서는 실패 확인, 수정 후 통과). 커밋 80678da. `npm run test:ci` pass 69/fail 0, `npm test` pass 65/fail 0. 재현 절차(`ci/batch.test.js` 반복)는 바뀌지 않음.
- 2 — test/pool.test.js에 onChunk done 시험 추가(같은 커밋). 위 테스트 결과에 포함.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(실제와 비슷한 지연으로 `ci/batch.test.js` 반복 실행)가 더 이상 실패하지 않는다 | 통과 | 최종 코드에서 `node --test ci/batch.test.js` 20회 반복, 실패 0 (fix.md 기준은 10회 중 4회 실패) |
| `npm run test:ci`가 통과한다 | 통과 | 최종 코드에서 10회 연속 실행 모두 pass 69/fail 0. 반영 전에는 ci/archive.test.js 때문에 약 절반 실패했음(지적 1) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 시험 변경 없음, 추가만 있음. ci/ 파일 변경 없음 |
| `npm test`도 계속 통과한다 | 통과 | `npm test` pass 65 / fail 0 |
| 동시 4개 병렬 실행 설정이 그대로 유지된다 | 통과 | src/config.js `concurrency: 4` 변경 없음, pool.js도 묶음 단위 병렬 유지 |
| 고쳤다는 근거로 `ci/batch.test.js`를 여러 번 반복 실행(예: 연속 20회)한 결과가 모두 통과한다 | 통과 | 연속 20회 실패 0 (ci/archive.test.js도 20회 실패 0) |
| 수정은 시험 파일이 아니라 원인이 있는 소스 코드에서 이루어진다 | 통과 | 소스 변경: src/runner/pool.js, src/store/report-archive.js. ci/ 시험은 그대로 |
| 같은 실패가 타이밍에 의존하지 않고 재현·검증되도록, 원인을 드러내는 시험이 추가되거나 기존 시험이 그 경우를 덮는다 | 통과 | test/pool.test.js '결과는 끝나는 순서가 아니라 items 순서다'(고정 지연; fix.md에서 수정 전 실패 확인), test/archive.test.js 동시 저장 시험(수정 전 실패 확인) |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 시험 2개 추가만, 기존 시험 불변
- test/archive.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험 불변

## 남은 위험
- runPool의 다른 호출자가 완료 순서에 기대는지는 test/ 통과 외에 확인하지 않음(호출자는 runner.js 하나뿐).
- report-archive의 임시 이름은 같은 reportId를 같은 ms에 동시에 두 번 저장하면 여전히 겹칠 수 있음(현재 배치에서는 reportId가 작업마다 고유).
