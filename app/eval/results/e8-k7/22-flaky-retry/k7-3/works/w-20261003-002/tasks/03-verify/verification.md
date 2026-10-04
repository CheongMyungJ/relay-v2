## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`ci/archive.test.js`를 여러 번 반복 실행해도 통과한다) | 통과 | `node --test ci/archive.test.js`를 30회 반복, 실패 0회 (fix.md 재현 시 15회 중 6회 실패와 비교). 새 재현 시험도 `npm test`에서 통과 |
| `npm run test:ci`가 통과한다 | 실패 | 13회 실행 중 3회 실패. 실패는 모두 `ci/batch.test.js` '밤 배치: 보고서마다 제 작업과 고객사가 붙는다'(`expected report-4 to belong to job-4, got job-3` 등). 비목표이며 `runPool`이 완료 순서로 결과를 모으는 원인(앞 Work w-20261003-001에서 수정 중). `ci/archive.test.js`는 실패 없음. 사람이 실패로 두고 완료 화면으로 가기로 함 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 0705ba4`: 테스트 파일은 test/archive.test.js에 시험 1개 추가만, 삭제·수정 없음 |
| `npm test`가 계속 통과한다 | 통과 | `npm test` pass 63 / fail 0 |
| 시험에 재시도, skip, 시간 제한 증가를 넣지 않고 `src/`의 원인을 고친다 | 통과 | 변경은 `src/store/report-archive.js`의 임시 파일 이름에 reportId 추가(원인 수정)와 시험 추가뿐. 동시성(4개) 변경 없음 |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 기존 시험은 그대로이고 동시 저장 재현 시험만 추가

## 남은 위험
- `npm run test:ci`가 `ci/batch.test.js`의 간헐 실패(`runPool` 완료 순서 결과 수집, 비목표) 때문에 가끔 실패한다. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기.
