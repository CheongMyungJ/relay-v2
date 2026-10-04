## 리뷰 지적
1. [권장] test/archive.test.js:97 — 새 동시 저장 시험이 가짜 시계(sleep이 시간을 앞으로 보냄) 때문에 수정 전 코드에서도 통과해 회귀를 잡지 못한다. 시험 안에서 sleep을 멈춰 같은 ms에 저장되게 할 것.
2. [사소] src/store/report-archive.js:23 — 임시 이름에 reportId와 `nextId('tmp')`가 있어 `stamp(now())`는 유일성에 필요 없다. 다만 임시 파일 식별에 도움이 되고 동작에 문제가 없어 둬도 된다.

## 반영
- 1 — 시험 첫 줄에 `setSleep(async () => {})` 추가(커밋 bc462bf). 기준 커밋의 report-archive.js로 되돌려 실행하면 이 시험이 실패(`not ok 10`)하고, 수정 코드에서는 통과함을 확인. `npm test` 64 통과, `npm run test:ci` 68 통과. 재현 절차는 그대로.
- 지식 갱신(docs/knowledge/batch/pool-order-and-tmp-names.md) 커밋.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`npm run test:ci`를 반복 실행)가 더 이상 실패하지 않는다 | 통과 | `npm run test:ci` 20회 반복, 실패 0회 (fix.md: 수정 전 6회 중 4회 실패). 반영 뒤에도 20회 재실행해 0회 실패 |
| `npm run test:ci`가 통과한다 | 통과 | 68 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff b7e3a70 -- test ci`: 시험 추가만 있고 기존 줄 삭제·변경 없음. ci/는 변경 없음 |
| `npm test`도 통과한다 | 통과 | 64 pass, 0 fail |
| `ci/archive.test.js`가 `ENOENT` 임시 파일 오류와 "보관본의 고객사가 다르다" 오류 없이 반복해서(예: 20회 연속) 통과한다 | 통과 | `npm run test:ci` 20회 연속 통과(ci/archive.test.js 포함, 실패 출력 없음), 단독 실행 2 pass |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 시험 하나 추가만 있고 기존 시험은 그대로. 수정 전 코드에서 실패함(fix.md)
- test/archive.test.js — 약화 아님 — 시험 하나 추가만 있고 기존 시험은 그대로. 반영 뒤 수정 전 코드에서 실패함을 확인

## 남은 위험
- runPool은 ci/batch.test.js 쪽 수정과 겹칠 수 있음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기
- 간헐 실패라 20회 통과가 완전한 증명은 아님
