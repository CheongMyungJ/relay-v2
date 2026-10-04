## 리뷰 지적
1. [권장] src/store/report-archive.js:24 — 임시 이름이 `.reportId.stamp.tmp`라 같은 reportId를 같은 ms에 동시에 저장하면 여전히 겹친다. 호출별 번호를 더할 것을 제안.
2. [사소] test/archive.test.js — 같은 reportId 동시 저장 시험이 없어 1번을 시험이 잡지 못한다. 시험 추가를 제안.

## 반영
- 1, 2번 (사람이 "모두 반영" 선택) — `saveReport`에 모듈 단위 카운터 `tmpSeq`를 임시 이름에 추가하고, 같은 보고서 동시 저장 시험을 추가. 커밋 "fix: 같은 보고서를 동시에 저장해도 임시 파일 이름이 겹치지 않게 호출별 번호를 더한다". `npm test` 통과(pass 65 / fail 0). 새 시험은 수정을 빼면 실패(fail 1)함을 확인. 재현 절차는 바뀌지 않음.

## 반영하지 않은 지적
- 없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 최종 코드에서 `npm run test:ci` 20회 반복: 모두 `# fail 0` (기준 커밋은 6회 중 4회 실패) |
| `npm run test:ci`가 통과한다 (로컬 `npm test`도 통과한다) | 통과 | `npm test` pass 65 / fail 0, `npm run test:ci` 20회 모두 fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff bbd7a8a`: 테스트 파일은 시험 추가만 있고 기존 시험 변경·삭제 없음 |
| `ci/batch.test.js`를 여러 번 반복 실행해도 `report-N`이 `job-N`에 속하지 않는 실패가 나오지 않는다 | 통과 | `node --test ci/batch.test.js` 20회 모두 `# fail 0`, `expected report` 실패 없음 |
| `ci/batch.test.js`에 재시도, skip, 시간 제한 증가를 넣지 않는다 | 통과 | `git diff bbd7a8a -- ci` 비어 있음, 파일에 retry/skip/timeout 없음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 입력 순서 시험 추가만, 기존 시험 그대로
- test/archive.test.js — 약화 아님 — 동시 저장 시험 2개 추가만, 기존 시험 그대로

## 남은 위험
- 임시 이름의 호출별 번호는 프로세스 안에서만 유일하다. 여러 프로세스가 같은 보관소에 같은 reportId를 같은 ms에 저장하면 겹칠 수 있다.
