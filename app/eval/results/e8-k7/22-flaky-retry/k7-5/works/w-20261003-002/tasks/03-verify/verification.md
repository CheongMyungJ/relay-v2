## 리뷰 지적
1. [권장] test/archive.test.js:97 — 새 "같은 ms에 동시에 저장" 시험이 수정 전에도 통과한다(가짜 sleep이 시계를 동기적으로 앞당겨 저장마다 now()가 달라짐). 시계를 고정하고 sleep을 비워 같은 ms 충돌을 실제로 재현하도록 제안.
2. [사소] src/store/report-archive.js:24 — 같은 reportId를 동시에 두 번 저장하면 같은 ms에 임시 이름이 여전히 겹칠 수 있다. 밤 배치는 보고서마다 한 번 저장하므로 현재 영향 없음.

## 반영
- 1 — test/archive.test.js 시험에 `setNow(() => t)`와 빈 `setSleep`을 넣어 시계를 멈춤. 커밋 1b61824. 수정 전 src/store/report-archive.js로 되돌려 실행하면 이 시험이 실패(63 pass, 1 fail)하고 수정 후에는 통과함을 확인. `npm test` 64 pass / 0 fail, `npm run test:ci` 20회 0회 실패. 재현 절차는 바뀌지 않음.
- 지식 파일 추가: docs/knowledge/save-report-temp-name-needs-report-id.md, docs/knowledge/test-fake-clock-hides-concurrency.md (커밋 3aea18a)

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(ci/archive.test.js 반복 실행)가 더 이상 실패하지 않는다 | 통과 | `node --test ci/archive.test.js` 20회 실행, 실패 0회 (fix.md의 수정 전 기록은 20회 중 9회 실패) |
| `npm run test:ci`가 통과한다 (`npm test`도 통과한다) | 통과 | `npm test` 64 pass / 0 fail. `npm run test:ci` 통과 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff ff52f88 --stat -- test ci`: test/archive.test.js와 test/pool.test.js에 추가만 있고(22줄 추가, 삭제 0), ci/는 변경 없음 |
| `npm run test:ci`를 20회 반복 실행해 모두 통과한다 | 통과 | `npm run test:ci` 20회 실행, 실패 0회 |
| 시험 코드(test/, ci/)에서 재시도, skip, timeout 증가, 지연 값·검증 완화를 쓰지 않는다 | 통과 | 기준 커밋 이후 test/ 변경은 새 시험 추가뿐이며 재시도, skip, timeout, 지연 값 변경 없음. ci/ 변경 없음. 시계 고정은 새 시험 안에서만 한다 |

## 테스트 파일 변경
- test/archive.test.js — 약화 아님 — 새 시험만 추가(시계를 고정해 수정 전에는 실패). 기존 시험은 그대로
- test/pool.test.js — 약화 아님 — 입력 순서 시험만 추가(수정 전 실패). 기존 시험은 그대로

## 남은 위험
- 같은 reportId를 동시에 두 번 저장하면 같은 ms에 임시 이름이 겹칠 수 있다(지적 2, 현재 호출 경로에는 없음)
- 앞 Work(w-20261003-001)에서 runPool 순서와 임시 파일 이름을 고쳤을 수 있음, 머지 대기. 머지 시 src/runner/pool.js, src/store/report-archive.js, docs/knowledge/ 충돌 가능
- ci/batch.test.js는 비목표라 확인하지 않았다
