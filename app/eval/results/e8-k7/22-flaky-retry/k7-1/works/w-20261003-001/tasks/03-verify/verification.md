## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행해도 `ci/batch.test.js`)가 더 이상 실패하지 않는다 | 통과 | `npm run test:ci` 30회 반복 실행, 실패 0회. 수정 전에는 fix.md 기준 8회 중 5회 실패 |
| `npm run test:ci`가 통과한다 | 통과 | 위 30회 모두 통과 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2b9d88e`: 테스트 파일은 test/pool.test.js, test/archive.test.js에 시험만 추가, 삭제·수정 없음. `npm test` pass 64 fail 0 |
| `ci/batch.test.js`에 재시도, skip, 시간 제한 증가가 추가되지 않는다 | 통과 | `ci/` 아래 변경 없음 (git diff에 없음) |
| 원인이 된 코드 경로를 고치고, 그 불일치를 잡는 시험이 있다 | 통과 | src/runner/pool.js, src/store/report-archive.js 수정. 두 파일을 기준 커밋 상태로 되돌리고 새 시험 2개를 돌리면 fail 2, 수정본에서는 15개 모두 통과 (원상 복구함) |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 입력 순서 반환 시험만 추가, 기존 시험 그대로
- test/archive.test.js — 약화 아님 — 같은 ms 동시 저장 시험만 추가, 기존 시험 그대로

## 남은 위험
- runPool 반환 순서가 입력 순서로 바뀜. 현재 호출자는 runner.js 하나뿐이고 collectResults가 입력 순서를 기대하므로 영향 없음
- 임시 파일 이름은 reportId+ms라서, 같은 reportId를 같은 ms에 동시에 두 번 저장하면 여전히 겹칠 수 있음 (같은 보고서 덮어쓰기라 실제 가능성 낮음)
