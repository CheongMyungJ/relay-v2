## 리뷰 지적
1. [사소] src/store/report-archive.js:23 — 임시 파일 이름이 `.<reportId>.<stamp>.tmp`라 같은 reportId를 같은 ms에 동시 저장하면 여전히 겹칠 수 있다. 현재 배치는 job마다 reportId가 고유해 발생하지 않는다. 필요하면 카운터 추가를 제안한다.

원인 적합성: fix.md의 두 원인(runPool 결과 순서, 임시 파일 이름 충돌)을 증상 가리기 없이 코드에서 고쳤다. 병렬 4개(`config.concurrency`)와 `ci/` 시험은 그대로다.

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`npm run test:ci`를 반복 실행해도 `ci/batch.test.js`가 실패하지 않는다) | 통과 | `npm run test:ci`를 20번 반복해 20번 통과 (수정 전 fix.md: 6번 중 3번 실패) |
| `npm run test:ci`가 통과한다 | 통과 | 위 20/20 통과 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f146495`에서 test/ 변경은 테스트 추가뿐이고 기존 테스트 줄 삭제·수정 없음, `ci/` 변경 없음 |
| `npm test`도 계속 통과한다 | 통과 | `npm test` 64개 통과, 0 실패 |
| `ci/batch.test.js`에 재시도, skip, 시간 제한 증가를 넣지 않는다 | 통과 | `git diff f146495 --stat -- ci`가 비어 있음 (ci/ 변경 없음) |
| 배치의 병렬 실행(동시 4개)을 유지하며, 순차 실행으로 되돌리지 않는다 | 통과 | `runPool`이 chunk 단위 `Promise.all`을 유지하고 runner.js가 `config.concurrency`를 그대로 전달 |
| `npm run test:ci`를 여러 번 반복 실행한 결과(실행 횟수와 통과 횟수)를 고쳤다는 근거로 보여 준다 | 통과 | 20번 실행, 20번 통과 (fix.md의 40/40은 참고용) |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 순서 보장 재현 테스트만 추가
- test/archive.test.js — 약화 아님 — 동시 저장 재현 테스트만 추가

## 남은 위험
- test:ci는 확률적 시험이라 반복 통과가 완전한 증명은 아니다.
- 같은 reportId의 동시 저장은 임시 파일 이름이 겹칠 수 있다(지적 1).
- 임시 파일 이름 형식이 바뀌었다(`.<reportId>.<stamp>.tmp`). 외부가 형식에 의존하면 영향이 있을 수 있다.
