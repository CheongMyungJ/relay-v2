## 리뷰 지적
1. [사소] src/digest/deadline.js:12 — `withDeadline`의 `timeoutMs` 인자가 더는 쓰이지 않는다. 이름·인자 정리를 제안하지만 호출부(runner.js:50)도 바꿔야 해서 범위 밖으로 봐도 무방하다.
2. [사소] test/retry.test.js 마지막 추가 테스트 — 제목은 "시간 초과가 아니라 실제 오류로"인데 `action`만 검사하고 `reason`은 검사하지 않는다. 실제로 `decide`는 제한 시간을 넘긴 실패에 reason `timeout`을 남긴다. 동작에는 영향이 없다.

## 반영
없음 (사람이 반영하지 않음을 선택)

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 수정 전 src로 `npm test` 실행 시 3개 실패(요약 메일 느린 성공, 메일 느린 성공, retry 느린 성공). 최종 코드 `npm test`는 79 pass, 0 fail |
| `npm test`가 통과한다 | 통과 | 최종 코드에서 `npm test` → 79 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 7d7867c`의 테스트 변경은 모두 추가뿐, 삭제·수정된 줄 없음 |
| 같은 알림이 중복 발송되던 상황(두 번 이상)을 재현하는 테스트가 추가되고, 수정 후 한 번만 발송됨을 검증한다 | 통과 | test/notifier.test.js, test/digest.test.js, test/retry.test.js의 새 테스트가 수정 전 실패, 수정 후 `mail.calls.length === 1` 등으로 통과 |
| 발송이 실제로 실패한 경우에는 재시도로 다시 발송됨을 검증하는 테스트가 통과한다 | 통과 | `메일 발송이 실제로 실패하면 재시도로 다시 보낸다`(mail.calls 2회, sent 1회) 통과 |

## 테스트 파일 변경
- test/digest.test.js — 약화 아님 — 테스트 1개 추가만 있음
- test/notifier.test.js — 약화 아님 — 테스트 2개 추가만 있음
- test/retry.test.js — 약화 아님 — 테스트 2개 추가만 있음

## 남은 위험
- 요약 키(src/digest/key.js)에 runId가 들어가 재실행 시 같은 요약이 다시 나갈 수 있다(이번에 고치지 않음).
- 어댑터가 오류를 던졌지만 실제로는 상대에게 간 경우는 막지 못한다.
- 운영 로그로 느린 성공이 원인임을 확인하지 못했다(가정).
- `send.timeoutMs`, `digest.sendTimeoutMs`는 성공 판정에는 더 쓰이지 않는다.
