## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `for i in $(seq 25); do node --test ci/batch.test.js ...` 25회 모두 `# fail 0` (fix.md의 수정 전: 20회 중 9회 실패) |
| `npm run test:ci`가 통과한다 | 통과 | pass 68 / fail 0 |
| `npm test`가 통과한다 | 통과 | pass 64 / fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff ff52f88` 상 test/pool.test.js, test/archive.test.js는 끝에 테스트 추가만 있고 삭제·수정 없음 |
| `ci/batch.test.js`를 여러 번(20회 이상) 연속 실행해 모두 통과한다 | 통과 | 25회 연속 `# fail 0` (`ci/archive.test.js`도 25회 통과) |
| 배치의 병렬 실행(동시 4개)이 유지된다 | 통과 | pool.js의 chunk + Promise.all 구조와 기본 concurrency 4(src/config.js:4)가 그대로. 바뀐 것은 결과 저장 위치뿐 |
| 수정이 시험이 아닌 `src/` 코드의 원인을 고친 것이다 | 통과 | 변경은 src/runner/pool.js(결과를 입력 순서로 저장), src/store/report-archive.js(임시 파일 이름). 재시도, skip, timeout 변경 없음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 기존 테스트는 그대로, 순서 보존 테스트 1개 추가
- test/archive.test.js — 약화 아님 — 기존 테스트는 그대로, 임시 파일 이름 충돌 테스트 1개 추가

## 남은 위험
- archive 임시 파일 수정은 batch 버그와 별개 원인이라 의도의 목표 문구보다 범위가 조금 넓다. `npm run test:ci` 통과에 필요했다.
- onChunk의 `done`은 별도 카운터로 바뀌었다. 기존 테스트는 통과하나 외부에서 쓰는 곳은 확인하지 않았다.
