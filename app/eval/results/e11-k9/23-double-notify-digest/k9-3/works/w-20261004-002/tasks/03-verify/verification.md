## 리뷰 지적
1. [차단] src/digest/runner.js(catch 분기), src/adapters/mail.js:6 — 메일 어댑터의 응답 시간 초과(`SendTimeoutError`)를 실패로 보고 재발송한다. 메일 서버 담당자 말로는 응답이 늦어도 받은 메일은 모두 나가므로, 이 경로도 중복의 원인이다. 시간 초과는 보낸 것으로 보고 재발송하지 않으며, 일시적 오류 등 진짜 실패는 계속 재시도한다. 가짜 전송의 timeout도 메일을 내보내도록 해서 검증한다. (사람이 지적하고 반영을 요청함)
2. [사소] test/digest.test.js:122 — 느린 성공 테스트가 `digest.slow` 지표(slow 표시)를 확인하지 않아, 그 지표가 빠져도 테스트가 통과한다. 지표 단언 추가를 제안.

## 반영
- 1 — 커밋 1db9490.
  - `src/digest/runner.js`: `SendTimeoutError`는 ledger에 `unconfirmed: true`로 보낸 것으로 남기고(`digest.sent`, `digest.unconfirmed` 지표, 경고 로그) 재발송하지 않는다.
  - `src/adapters/mail.js`: 연결이 끊긴 `ECONNRESET`은 받았다고 볼 수 없어 timeout에서 빼고 transient `SendError`(`econnreset`)로 바꿔 재시도한다.
  - `src/adapters/fake-transports.js`: 메일의 `fail: 'timeout'`은 `sent`에 `timedOut: true`로 메일을 남기고 오류를 던진다.
  - `test/digest.test.js`: 이전 task가 추가한 "실제로 실패한 요약은 재시도…" 테스트를 일시적 오류(재시도) 테스트로 바꾸고 3개를 더했다.
  - 경로별 근거: 일시적 오류 → 재시도해 1통(calls 2, sent 1). ECONNRESET → 재시도해 1통. timeout → 재발송 없이 1통(calls 1, sent 1, 재실행 `already` 1). 일시적 오류 뒤 timeout → 2번 호출에 1통. 영구 오류는 기존 테스트가 그대로 확인.
  - 반영 전 코드로 되돌려 확인: runner를 되돌리면 timeout 테스트 2개 실패, mail.js를 되돌리면 ECONNRESET 테스트 1개 실패.
  - `npm test` → 80 pass, 0 fail.
  - 재현 절차는 바뀌지 않음(새 테스트 3개는 그대로, 일시적 오류+timeout 테스트가 같은 시나리오를 새 의미로 확인).
  - 지식 `docs/knowledge/delivery/success-beats-timeout.md`를 같은 경로에서 고침.

## 반영하지 않은 지적
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 기준 커밋의 `src/digest/{deadline,key,runner}.js`로 되돌린 임시 사본에서 `npm test` → 새 테스트 3개 실패(74 pass / 3 fail). 최종 코드에서 같은 시나리오(느린 성공 1통, runId만 바꾼 재실행 `already=1`, 일시적 오류 재시도 후 재실행 1통) 통과. |
| `npm test`가 통과한다 | 통과 | 최종 코드에서 `npm test` → 80 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff be97819`: 기준 커밋에 있던 테스트는 수정·삭제 없음. 바뀐 것은 이 Work가 추가한 테스트뿐 |
| 요약이 한 번 성공적으로 발송된 뒤에는 같은 날 요약이 다시 발송되지 않음을 확인하는 테스트가 있다 | 통과 | `느리게 끝났어도 성공한 요약은…`, `같은 날짜 요약을 다시 실행해도…`, `응답이 늦어 timeout이 났어도…`(재실행 `already` 1) 통과 |
| 요약 발송이 실제로 실패한 경우 재시도로 다시 발송됨을 확인하는 테스트가 있다 | 통과 | `일시적 오류로 실제 실패한 요약은 재시도로…`(calls 2, sent 1), `연결이 끊겨 못 보낸 요약은…`(calls 2, sent 1). 영구 오류는 기존 `영구 오류는 다시 보내지 않는다`. 재시도 로직은 변경 없음 |

## 테스트 파일 변경
- test/digest.test.js — 약화 아님 — 기준 커밋의 기존 테스트는 그대로다. 이 Work가 추가한 테스트 하나(`실제로 실패한 요약은 재시도…`, timeout을 재시도하던 것)는 timeout이 보낸 것이라는 새 사실에 맞춰 일시적 오류 테스트로 바꾸고, 경로별 테스트로 늘렸다. 재시도 검증은 줄지 않았고 일시적 오류·ECONNRESET 두 경로로 확인한다.

## 남은 위험
- 요약 메일의 timeout을 "보낸 것"으로 보는 근거는 메일 서버 담당자의 말이다. 실제 중계 서버가 일부 timeout에서 메일을 받지 못하면 그 요약은 재발송되지 않고 그날 요약이 빠질 수 있다(`unconfirmed: true` 기록과 `digest.unconfirmed` 지표로 추적 가능).
- 푸시·일반 알림 경로(`src/retry/policy.js`의 `decide`, `src/adapters/push.js`)는 이번 요청(요약 메일) 밖이라 바꾸지 않았다. `decide`는 성공이어도 timeout이면 재시도하는 구조다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- 보낸 키 보관(`digest.ledgerTtlMs`, 기본 3일)이 지난 뒤 같은 기간을 재실행하면 다시 보낼 수 있다.
