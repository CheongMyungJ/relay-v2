## 리뷰 지적
1. [사소] src/store/report-archive.js:23 — 같은 reportId를 같은 ms에 동시에 두 번 저장하면 임시 파일 이름이 겹칠 수 있다. 현재 호출 경로(nightly의 report-N은 서로 다름)에는 없다. 카운터 등을 넣을 수 있으나 범위가 늘어난다.

(그 밖에 원인 일치, 동시 4개 유지, 불필요한 변경 없음, 새 시험이 수정 전 실패함을 fix.md로 확인. 추가 지적 없음)

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않기로 함)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `node --test ci/batch.test.js` 20회: PPPPPPPPPPPPPPPPPPPP, `ci/archive.test.js` 20회도 모두 P |
| `npm run test:ci`가 통과한다 | 통과 | 10회 반복, 매번 fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기존 시험 변경 없음, 시험 2개 추가만 (`git diff 0705ba4`) |
| `npm test`가 계속 통과한다 | 통과 | pass 64, fail 0 |
| `ci/batch.test.js`를 여러 번 반복 실행해도(예: 20회) 한 번도 실패하지 않는다 | 통과 | 20회 중 20회 통과, 0회 실패 |
| 병렬 실행(동시 4개)이 그대로 유지된다 | 통과 | 변경은 pool.js의 결과 저장 위치뿐, 청크 크기(concurrency)와 nightly 설정 diff 없음. 신규 pool 시험이 concurrency 4로 통과 |
| 반복 실행 횟수와 통과/실패 결과가 검증 결과(handoff)에 기록된다 | 통과 | handoff.md에 batch 20/20, archive 20/20, test:ci 10/10 기록 |
| 수정이 `ci/batch.test.js`의 재시도, skip, 시간 제한 변경 없이 소스 코드(`src/`)에서 이루어진다 | 통과 | 변경 파일: src/runner/pool.js, src/store/report-archive.js (+test/ 2개). ci/ 변경 없음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험·기대값 변경 없음
- test/archive.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험·기대값 변경 없음

## 남은 위험
- 같은 reportId를 같은 ms에 동시에 두 번 저장하면 임시 파일이 겹칠 수 있다(현재 호출 경로에는 없음).
- 반복 횟수(20회)는 확률적 확인이라 실패율이 매우 낮은 경우는 걸러내지 못할 수 있다. 수정 전에는 20회 중 7회 실패했다.
