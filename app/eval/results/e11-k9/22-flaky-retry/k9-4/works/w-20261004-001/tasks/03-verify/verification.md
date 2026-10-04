## 리뷰 지적
1. [차단] src/store/report-archive.js:23 — 임시 파일 이름이 `.${stamp(now())}.tmp`여서 같은 ms에 동시에 저장하는 두 보고서(동시 4개 병렬)가 같은 임시 파일을 쓴다. 한쪽이 다른 고객사 내용을 옮기거나(`report-7 보관본의 고객사가 다르다: wonka (wayne여야 함)`) `ENOENT: reports/2026-09/.xxxx.tmp`가 난다. fix 시점에는 `ci/batch.test.js`만 반복해서 `ci/archive.test.js`의 간헐 실패를 보지 못했다. 이 지적을 반영하기 전 `npm run test:ci` 10회 중 3회 실패, `ci/archive.test.js` 단독 10회 중 4회 실패. 임시 이름에 reportId를 넣자고 제안.
(`src/runner/pool.js` 수정은 원인과 맞고 지적 없음)

## 반영
- 1 — 임시 이름을 `.${reportId}.${stamp}.tmp`로 변경 (`listReports`/`strayTemps`가 쓰는 `.` 시작·`.tmp` 끝 규칙 유지). 커밋 f01a4eb. 재현 절차(`ci/batch.test.js` 반복)가 쓰는 코드는 바꾸지 않았다. 반영 후 `npm test` pass 63 / fail 0, `npm run test:ci` 20회 모두 통과, `ci/batch.test.js` 20회·`ci/archive.test.js` 20회 모두 통과.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`ci/batch.test.js` 반복) | 통과 | `node --test ci/batch.test.js` 최종 코드에서 20회 실패 0 (수정 전 fix.md: 6회 중 3회 실패). 같은 증상의 `ci/archive.test.js`도 20회 실패 0 |
| `npm run test:ci`가 통과한다 | 통과 | 최종 코드에서 실행, 통과 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 바뀐 테스트는 test/pool.test.js 케이스 추가뿐, 기존 케이스·ci/ 파일 변경 없음 (`git diff c3226c0 --stat -- ci` 비어 있음) |
| `npm test`가 통과한다 | 통과 | `npm test` pass 63 / fail 0 |
| `npm run test:ci`를 여러 번 반복 실행한 결과가 모두 통과한다 (횟수와 결과 기록) | 통과 | 최종 코드에서 20회 반복, 실패 0. (반영 전에는 10회 중 3회 실패했었다) |
| 동시 4개 병렬 실행이 유지된다 | 통과 | `src/config.js` 기본 `concurrency: 4`, `runPool`의 `Promise.all` 묶음 구조 그대로 |
| `ci/batch.test.js`에 재시도, skip, 시간 제한 증가가 추가되지 않았다 | 통과 | `ci/` 아래 변경 없음 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 기존 케이스는 그대로 두고 입력 순서 보존 케이스 1개만 추가. 이번 리뷰 반영에서는 테스트 파일을 바꾸지 않았다.

## 남은 위험
- 임시 이름 충돌을 막는 회귀 테스트를 추가하지 않았다. 간헐 실패를 `ci/archive.test.js` 반복으로만 잡는다(비목표인 구조 변경을 피함).
- 같은 reportId를 같은 ms에 두 번 저장하면 여전히 겹칠 수 있다(현 배치에서는 reportId가 작업마다 고유).
- runPool을 쓰는 곳은 runner.js뿐임을 확인했다.
