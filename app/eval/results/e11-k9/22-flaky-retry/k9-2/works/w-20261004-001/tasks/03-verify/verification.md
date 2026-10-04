## 리뷰 지적
1. [차단] src/store/report-archive.js:23 — 임시 파일 이름이 `.${stamp(now())}.tmp`(ms 단위)라 같은 ms에 저장하는 보고서끼리 이름이 겹친다. 겹치면 한 보고서가 다른 고객사의 내용으로 덮이거나 rename이 ENOENT로 실패한다. 수정 전 코드에서 `npm run test:ci`의 ci/archive.test.js가 반복 실행 중 약 절반 실패(`expected 'initech', actual 'umbrella'` 등)했다. fix.md가 적은 "test:ci 67 통과"와 다르다. 제안: 임시 이름에 reportId를 넣는다.
2. [사소] test/pool-order.test.js — 첫 시험이 sleep 시간 차에 의존한다. 순서가 우연히 맞을 가능성이 낮아 그대로 둬도 무방하다.

## 반영
- 1 — `.${report.reportId}.${stamp(now())}.tmp`로 변경, 커밋 44e2193. 반영 뒤 `npm test` 63 통과/0 실패, `npm run test:ci` 67 통과/0 실패, `npm run test:ci` 30회 반복 모두 통과. 재현 절차(ci/batch.test.js 반복)는 바꾸지 않았다.

## 반영하지 않은 지적
- 2 (사람이 고르지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 최종 코드에서 `node --test ci/batch.test.js` 30회 반복, 실패 0 (fix.md 수정 전 3/20 실패) |
| `npm test`가 통과한다 | 통과 | 63 통과/0 실패 |
| `npm run test:ci`가 통과한다 | 통과 | 67 통과/0 실패, 30회 반복 모두 통과. 지적 1 반영 전에는 ci/archive.test.js가 간헐 실패했음 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 바뀐 테스트 파일은 새로 추가한 test/pool-order.test.js뿐, 기존 시험 변경·삭제 없음 |
| ci/batch.test.js를 반복 실행(20회 이상)해 모두 통과한다 | 통과 | 30회 반복 모두 통과 |
| 보고서 결과가 작업과 어긋날 수 있던 원인이 코드에서 제거되며, 시험 쪽 우회로 가리지 않는다 | 통과 | pool.js의 완료 순서 push → 입력 순서 자리(`results[start + i]`)로 교체, report-archive.js의 임시 이름 충돌 제거. 재시도·skip·시간 제한·LATENCY 변경 없음 |

## 테스트 파일 변경
- test/pool-order.test.js — 약화 아님 — 새로 추가한 재현 시험. 기존 시험을 건드리지 않았다.

## 남은 위험
- 임시 이름 충돌 수정(지적 1)에는 전용 재현 시험이 없다. ci/archive.test.js가 지연 속에서 잡아 주지만 확률적이다.
- 같은 reportId를 같은 ms에 두 번 저장하면 임시 이름이 여전히 겹친다 (현재 배치에서는 reportId가 작업마다 달라 해당 없음).
- runPool 외부 사용처는 확인하지 못했다 (src에서는 runner.js뿐).
