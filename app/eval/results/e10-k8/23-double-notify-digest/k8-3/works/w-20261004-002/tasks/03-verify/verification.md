## 리뷰 지적
1. [권장] src/digest/runner.js:45-46 — `ledger.claim` 뒤의 `inbox.itemsFor`/`buildDigestMessage`가 try 밖이라 여기서 던지면 inFlight 키가 풀리지 않는다. 그 요약이 재시도·재실행에서도 "이미 보냄"으로 건너뛰어져 하루 건너뛰는 위험이 된다. 제안: 메시지 만들기를 try 안으로 옮긴다.
2. [사소] src/digest/runner.js:39 — `digestKey`가 더는 runId를 쓰지 않는데 `runId`를 넘긴다. 인자 제거 제안.

## 반영
- 1 — 메시지 생성을 try 안으로 옮겨 던져도 catch에서 release되게 함. 커밋 d0dd202. `npm test` 82개 통과. 재현 절차는 바뀌지 않음.
- 지식 커밋: docs/knowledge/digest/digest-key-and-claim.md 신규, docs/knowledge/retry/slow-success-is-not-failure.md 갱신(낡은 남은 위험 정리).

## 반영하지 않은 지적
- 2 (사람이 고르지 않음)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 기준 커밋 src에 새 테스트를 얹어 `npm test`: 82개 중 5개 실패(재시도 2, 수동 재실행, 스케줄러 재실행, 동시 실행). 현재 브랜치 `npm test`: 82개 모두 통과 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 82, pass 82, fail 0 (최종 코드) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 92c70b5 --stat -- test`: test/digest.test.js 추가 100줄, 삭제 0줄 |
| 같은 기간 요약이 중복되는 각 경로에 대해, 고객 수신 횟수가 1회임을 보이는 테스트가 있다 | 통과 | test/digest.test.js: 재시도(2건), 수동 재실행, 스케줄러 재실행(재시작 대용), 동시 실행 테스트가 수정 전 실패·수정 후 통과. 프로세스 재시작은 메모리 ledger 한계로 새 스케줄러+같은 ledger로 대신 검증. 서버 간 동시 실행 경로는 테스트도 보호도 없음(남은 위험 참고) |
| 발송이 실제로 실패한 요약은 재시도로 다시 발송되고 건너뛰어지지 않음을 보이는 테스트가 있다 | 통과 | "실패한 요약은 다시 보내고…"(2건), "실제 시간 초과 실패는 계속 재시도한다", 기존 "일시적 오류는 잠시 뒤 다시 보낸다" 통과 |
| 중복을 막는다는 이유로 재시도 기능을 끄거나 재시도 횟수를 줄이는 변경이 없다 | 통과 | `git diff 92c70b5 -- src`에 maxAttempts·retryDelayMs·재시도 분기 변경 없음. 시간 초과 판정 변경은 성공을 실패로 보지 않게 한 것 |

## 테스트 파일 변경
- test/digest.test.js — 약화 아님 — 기존 테스트는 그대로, 새 테스트 8건만 추가

## 남은 위험
- **서버 두 대 동시 실행은 이번 수정으로 막히지 않는다.** ledger는 메모리 구현뿐이고(`src/notifier.js:70`, `src/digest/ledger.js`), `claim`은 프로세스 안의 `inFlight`/`sentKeys`만 본다(`ledger.js:19-23`). 서버마다 ledger가 따로라 두 서버가 같은 사용자 요약을 동시에 보내면 둘 다 claim에 성공해 중복이 남는다. 배포 당일 아침 추가 실행도 서버가 다르면 같다. 후속으로 공유 DB ledger가 필요하다: 키 unique 제약 등 조건부 삽입으로 claim을 원자적으로 하고, 선점 만료(lease TTL)를 둬서 서버가 선점한 채 죽어도 요약이 건너뛰어지지 않게 한다. 키(`digest:${period}:${userId}`)는 이미 서버 간에 안정적이다.
- 메모리 ledger는 프로세스 재시작 시 기록이 사라진다(같은 후속으로 해결).
- 실제 시간 초과로 실패했지만 서버가 이미 보낸 경우의 중복은 막을 수 없다.
- 지적 1(release 보장)을 고친 변경에는 전용 테스트를 추가하지 않았다.
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: src/retry/policy.js (이 브랜치에서 미변경).
