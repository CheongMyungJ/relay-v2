## 리뷰 지적
1. [권장] src/digest/scheduler.js:41-49 — 예외로 끝나는 기간은 `rounds` 상한 없이 매 tick 재시도되고, 앞 기간의 예외가 뒤 기간의 발송을 막는다. 예외도 `digest.maxAttempts`회까지만 재시도하고 기간별로 격리하길 제안.
2. [사소] src/digest/scheduler.js:28-30 — 시작 기간 계산이 `if (!lastPeriod) p = target`으로 덮어써져 읽기 어렵다.
3. [사소] src/digest/deadline.js:15 — `timeoutMs` 인자가 쓰이지 않는다(호출부 호환용 죽은 인자).

## 반영
- 1 — 기간별 try/catch로 한 기간의 예외가 뒤 기간을 막지 않게 했다. 예외도 `maxAttempts`회 뒤에는 `unfinished`에서 지우고 `lastPeriod`를 넘긴다. 모든 기간이 예외면 첫 예외를 그대로 던진다(기존 동작 유지). 회귀 테스트 1개 추가. 커밋 d45faf8. `npm test` → 80개 통과, 0 실패. 새 테스트는 직전 scheduler.js에서는 실패, 수정 후 통과를 확인했다. 재현 절차(`node --test test/digest-duplicate.test.js`)는 그대로 쓰고 테스트 수만 5→6개.

- 사람 추가 요청(서버 두 대·재시작 중복) — `src/digest/claims.js` 신설(선점 인터페이스 `claim/confirm/release`와 메모리 구현), ledger가 발송 전 `claim`, 성공 시 `markSent`로 확정, 실패 시 `release`. `createNotifier({ digestClaims })`로 공유 저장소 주입, `digest.claimTtlMs`(기본 10분) 추가. 신규 `test/digest-claims.test.js` 5개(서버 두 대 동시, 수십 분 간격, 재시작, 실패 후 선점 해제, 서버 사망 후 선점 만료). 이전 커밋 소스에서 1·2·3·5번 실패, `release` 호출을 제거한 변형에서 4번 실패 확인. `npm test` → 85개 통과, 0 실패. 재현 절차(`node --test test/digest-duplicate.test.js`)는 그대로.

## 반영하지 않은 지적
- 2
- 3

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (같은 날 같은 수신자에게 요약이 두 번 이상 발송되지 않는다) | 통과 | `node --test test/digest-duplicate.test.js` → 6개 통과. `node --test test/digest-claims.test.js` → 5개 통과. 메일 지연 5000ms 사용자 1명은 1통(수정 전 3통), 같은 기간 두 번 실행해도 1통 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 85, pass 85, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f2e1b1e --name-only -- test`에 새 파일 `test/digest-duplicate.test.js`만 있고 기존 테스트 변경·삭제 없음 |
| 발송이 실패한 요약은 이후 다시 발송되는 것을 테스트로 확인한다 | 통과 | `발송이 끝내 실패한 요약은 다음 일정에서 다시 보낸다` 통과(첫 tick 0통, 다음 tick 1통, 그 뒤 추가 발송 없음) |
| 하루를 건너뛰는 요약이 없음을 테스트로 확인한다 | 통과 | `일정이 하루를 놓쳐도 건너뛴 날의 요약을 보낸다`, `요약 발송 중 예외가 나도…다시 시도한다`, 신규 예외 상한 테스트 통과 |
| 중복 발송 재현 테스트가 추가되어 수정 전에는 실패하고 수정 후에는 통과한다 | 통과 | 기준 커밋(f2e1b1e) 소스에 이 테스트 파일을 얹어 실행 → 6개 모두 실패. 현재 코드에서는 6개 통과 |

## 테스트 파일 변경
- test/digest-claims.test.js — 약화 아님 — 새로 추가한 파일(5개). 기존 테스트 변경 없음.
- test/digest-duplicate.test.js — 약화 아님 — 새로 추가한 파일(6개). 기존 테스트는 바뀌지 않았고, 이번 verify에서 예외 상한 테스트 1개를 더했다.

## 남은 위험
- 선점 저장소의 기본 구현은 프로세스 메모리다. 운영에서 서버 두 대·배포 날 중복을 막으려면 공유 저장소 구현(DB 유니크 키, Redis SET NX 등)을 `digestClaims`로 주입해야 한다. 주입 전에는 남는다.
- 보낸 직후 확정 전에 서버가 죽으면 선점 기간(10분) 뒤 다시 보내져 드물게 중복된다. 메일 어댑터 멱등 키가 필요하다.
- 보내는 데 `claimTtlMs`보다 오래 걸리면 다른 서버가 같은 요약을 선점할 수 있다.
- `unfinished`·`lastPeriod`는 여전히 메모리라 재시작하면 기간을 다시 돌 수 있다(선점 저장소가 공유되면 중복 발송은 걸러진다).
- ETIMEDOUT처럼 전달 여부를 모르는 어댑터 오류는 계속 재시도되어 드물게 중복될 수 있다(멱등 키 필요).
- 반영하지 않은 사소한 지적 2, 3(가독성·죽은 인자)이 남아 있다.
- 앞 Work(w-20261004-001)에서 `retry/` 쪽을 고쳤을 수 있음, 머지 대기.
