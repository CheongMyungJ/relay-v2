## 리뷰 지적
1. [사소] src/store/report-archive.js:24 — 임시 파일 이름이 reportId+ms 시각이라, 같은 reportId를 같은 ms에 동시에 저장하면 겹칠 수 있다. 현재 배치는 job마다 reportId가 달라 해당 없음.
2. [사소] test/pool.test.js:38 — 순서 시험이 실제 setTimeout 지연(최대 20ms)에 의존한다. 순서 보장은 결정적이라 통과는 안정적이나 느린 환경에서 의미가 흐려질 수 있다. 제안 없음.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | fix.md의 재현 절차 `for i in $(seq 8); do npm run test:ci; done`를 다시 실행: 8/8 통과 (기준 커밋은 8회 중 3회 실패) |
| `npm run test:ci`가 통과한다 (로컬 `npm test`도 통과한다) | 통과 | `npm run test:ci` 통과, `npm test` 64개 중 pass 64, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 54b9280` 결과 테스트 파일은 추가만 있고 기존 줄 변경·삭제 없음, ci/ 변경 없음 |
| `npm run test:ci`를 여러 번(예: 20회) 반복 실행해도 ci/batch.test.js가 매번 통과한다 | 통과 | `npm run test:ci` 20회 반복: 20/20 통과 |
| 배치가 동시 4개 병렬 실행을 유지한다 | 통과 | runPool을 concurrency 4, 10개 항목으로 직접 실행: 동시 실행 최대 4, 결과 0..9 순서. config 기본값 concurrency: 4 그대로 |
| 반복 실행(`npm run test:ci` 20회)의 통과 횟수를 검증 결과에 근거로 기록한다 | 통과 | 이번 검증에서 직접 20회 실행, 통과 20회 (재현 절차 8회는 별도로 8/8) |
| 수정이 시험 쪽 재시도, skip, 시간 제한 변경 없이 제품 코드(또는 시험의 잘못된 가정)의 원인을 해결한다 | 통과 | 변경은 src/runner/pool.js(결과를 인덱스 자리에), src/store/report-archive.js(tmp 이름에 reportId)뿐. 재시도·skip·timeout 변경 없음. fix.md의 원인과 일치 |

## 테스트 파일 변경
- test/pool.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험 그대로
- test/archive.test.js — 약화 아님 — 시험 1개 추가만, 기존 시험 그대로

## 남은 위험
- archive 임시 파일 충돌 수정은 intent가 언급한 batch.test.js 밖이다(같은 test:ci 안정화 목적).
- 임시 파일 이름 형식이 바뀌었다(.reportId.stamp.tmp). 정산팀이 이름 규칙에 의존하면 확인 필요.
- 같은 reportId를 같은 ms에 동시 저장하는 경우는 여전히 겹칠 수 있다(지적 1).
