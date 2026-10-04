## 리뷰 지적
1. [사소] src/digest/deadline.js:14 — `withDeadline`이 더 이상 시간을 강제하지 않는데 이름과 미사용 인자 `_timeoutMs`가 남아 오해를 부른다. 이름을 `measure` 등으로 바꾸고 인자를 정리하는 안.
2. [사소] test/digest.test.js — 같은 기간을 `ledgerTtlMs`(3일) 뒤 다시 실행하면 재발송되는 경계는 테스트가 없다. 의도된 동작이라 필요하면 테스트로 고정.

## 반영
없음 (사람이 "반영하지 않음" 선택)

## 반영하지 않은 지적
- 1, 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (같은 날 요약이 두 통 이상 나가지 않는다) | 통과 | 기준 커밋의 src로 `node --test test/digest.test.js`: 새 테스트 3개 실패(pass 9 fail 3). 현재 코드 `npm test`: 77 통과. 지연 3500ms에서도 mail.calls 1건 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 77, pass 77, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 830fa47 -- test`: 추가 33줄뿐, 삭제·수정 없음 |
| 발송이 실제로 실패한 요약은 여전히 재시도되어 결국 발송되는 것을 테스트가 확인한다 | 통과 | 테스트 "느리고 실패한 요약 발송은 여전히 다시 보내…": calls 2, 상태 ['retry','sent'] |
| 요약 발송이 성공한 날은 발송 기록(sent)이 남고, 요약이 하루 건너뛰어지지 않는 것을 테스트가 확인한다 | 통과 | 테스트 "성공한 요약 발송은 느려도…": summary.sent 1, 상태 ['sent'] |
| 중복 발송을 재현하는 회귀 테스트가 추가된다 | 통과 | 새 테스트 3개가 기준 코드에서 실패, 수정 후 통과 |

## 테스트 파일 변경
- test/digest.test.js — 약화 아님 — 회귀 테스트 3개만 추가, 기존 테스트 변경 없음

## 남은 위험
- 일반 알림 `src/retry/policy.js` decide()는 성공이어도 elapsedMs>timeoutMs면 timeout 재시도(dispatcher.js:48). 요약 경로는 쓰지 않음. 비목표라 미수정, 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기
- sent 키는 ledgerTtlMs(3일)가 지나면 사라져 그 뒤 같은 기간 재실행은 재발송 가능
- withDeadline은 느린 발송을 막지 않아 뒤 사람들의 요약이 밀리는 것은 지표로만 드러남
- 메일 어댑터 자체 타임아웃 경로(src/adapters/mail.js:41, ETIMEDOUT/ESOCKETTIMEDOUT/ECONNRESET → transient SendTimeoutError)는 이번 수정 범위 밖이다. 서버가 메일을 받았는데 응답만 늦거나 끊긴 경우 요약 러너가 재시도해 같은 메일이 또 나갈 수 있다(sent 키가 안 남음). 재현·검증하지 못함(가짜 transport의 timeout은 보내지 않고 던짐)
