## 리뷰 지적
1. [사소] test/pool.test.js:40 — `async (ms, ) =>`에 불필요한 쉼표. 제거 제안.
2. [사소] src/store/report-archive.js:23 — 같은 reportId를 같은 ms에 동시 저장하면 tmp 이름이 여전히 겹칠 수 있다. 현재 호출 경로에는 없어 제안 없음(위험으로 기록).

원인(runPool 완료 순서 push, tmp 이름 충돌)에 맞는 src 수정이고 증상을 가리는 변경은 아니다. 비목표 위반 없음.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`ci/batch.test.js`의 간헐적 실패)가 더 이상 실패하지 않는다 | 통과 | `node --test ci/batch.test.js` 15회 반복, 실패 0. 재현 테스트 2건 포함 `npm test` 통과 |
| `npm run test:ci`가 통과한다 | 통과 | 15회 반복, 실패 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff d2c6ce3`: 시험 파일 2개에 추가만 있고 기존 줄 삭제·수정 없음 |
| `npm test`도 통과한다 | 통과 | pass 64, fail 0 |
| 시험 쪽에 재시도, skip, 시간 제한 증가를 넣지 않고 원인이 되는 코드(src)에서 고친다 | 통과 | 수정은 src/runner/pool.js, src/store/report-archive.js. `ci/` 변경 없음, 시험은 재현 테스트 추가뿐 |
| `ci/batch.test.js`를 여러 번 반복 실행해도 실패하지 않는다 | 통과 | 15회 반복 실패 0 (fix.md는 30회) |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 재현 테스트 1건 추가만, 기존 시험 변경 없음
- test/archive.test.js — 약화 아님 — 재현 테스트 1건 추가만, 기존 시험 변경 없음

## 남은 위험
- 같은 reportId를 같은 ms에 동시 저장하면 tmp 이름이 겹칠 수 있음(현재 호출 경로 없음)
- runPool 결과 배열은 이제 항상 입력 순서(done 의미는 유지)
- 반복 검증은 각 15회라 드물게 나타나는 실패는 놓칠 수 있음
