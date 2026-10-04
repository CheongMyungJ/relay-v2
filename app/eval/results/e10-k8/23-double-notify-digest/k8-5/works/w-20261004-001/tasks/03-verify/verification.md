## 리뷰 지적
1. [사소] test/duplicate-send.test.js — 새로 넣은 slow 지표(`send.<채널>.slow`, `digest.slow`)를 검증하는 단언이 없다. 느린 성공 테스트에 지표 단언 추가를 제안.
2. [사소] src/dispatch/dispatcher.js:47 — slow 판정(`elapsedMs > timeoutMs`)이 withDeadline과 두 곳에 나뉘어 있다. 동작 문제는 없고 정리 제안만.

차단·권장 지적 없음. 수정은 원인(성공 후 시간 초과 판정)을 policy.js와 deadline.js 두 경로에서 직접 고쳤고, 재시도·정책 값은 그대로다.

## 반영
- (사람 추가 요청, 지적 번호 없음) 푸시 느린 성공 테스트와 푸시 실제 시간 초과 재시도 테스트를 test/duplicate-send.test.js에 추가, 커밋은 `git log -1` 기준 최신. `npm test` 81건 통과. 재현 절차는 그대로.

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `node --test test/duplicate-send.test.js` → pass 7 / fail 0. 기준 커밋(f6a83d0)을 임시 worktree에 두고 같은 테스트를 돌리면 pass 3 / fail 4(느린 성공 4건 실패: decide, 메일, 푸시, 요약)이라 재현이 확인됨 |
| `npm test`가 통과한다 | 통과 | `npm test` → 81건 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff f6a83d0 --name-status -- test` → `A test/duplicate-send.test.js`만 있음. 기존 테스트 변경·삭제 없음 |
| 같은 알림이 중복 발송되던 상황을 재현하는 테스트가 추가되고, 수정 후 한 번만 발송됨을 검증한다 | 통과 | 느린 메일/푸시/요약/decide 테스트 4건이 수정 전 실패, 수정 후 통과. 메일은 `mail.calls.length === 1`, 재시도 큐 0 |
| 발송이 실제로 실패한 경우에는 재시도로 다시 발송됨을 검증하는 테스트가 통과한다 | 통과 | `fail: 'timeout'` 메일·푸시·요약 테스트 3건이 수정 전후 모두 통과(`calls.length === 2`, `sent.length === 1`) |

## 테스트 파일 변경
- test/duplicate-send.test.js — 약화 아님 — 새로 추가한 파일이다. 기존 테스트는 바뀌지 않았다.

## 남은 위험
- 응답을 못 받고 실제로 실패한 경우는 어댑터가 오류(ETIMEDOUT 등)를 던져야 재시도된다. 어댑터가 오류 없이 늦게 성공을 돌려주는 경우는 성공으로 본다.
- 요약 키(src/digest/key.js)에 runId가 들어가고 기본 runId에 시각이 있어, 같은 기간을 다시 run하거나 재시작으로 scheduler의 lastPeriod가 사라지면 요약이 또 나갈 수 있다(이번 범위 밖).
- slow 지표는 테스트로 검증되지 않는다(지적 1).
