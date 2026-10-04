## 재현
- 재현 절차: `test/digest.test.js`에 추가한 테스트 3개를 기준 커밋 코드에서 `node --test test/digest.test.js`로 실행. 메일 지연 3500ms(요약 제한 3000ms 초과)로 요약을 한 번 보내거나, 같은 기간 `digest.run`을 두 번 부른다.
- 결과: 재현됨
- 기대: 수신자당 한 통, 성공하면 sent 기록이 남는다.
- 실제: 성공했는데 `summary.sent`는 0, 발송 기록에 sent 없음, 재시도로 같은 메일이 다시 나감(maxAttempts까지). 같은 기간을 다시 실행하면 이미 보낸 사람에게 또 나간다.

## 원인
- 원인: 두 가지가 겹친다. (1) `withDeadline`(src/digest/deadline.js)이 발송이 성공했어도 걸린 시간이 sendTimeoutMs(3000ms)를 넘으면 SendTimeoutError를 던진다. 러너는 이를 일시적 오류로 보고 `markSent` 없이 재시도해 같은 요약이 두세 통 나간다. (2) `digestKey`(src/digest/key.js)에 runId가 들어 있어 실행이 다르면(재실행, 재시작, 서버 여러 대) 키가 달라져 `ledger.has`가 이미 보낸 요약을 못 알아본다.
- 근거: 수정 전 새 테스트 3개 중 (1)을 겪는 2개(33, 35)와 (2)를 겪는 1개(34)가 실패. 수정 뒤 77개 전부 통과. 메일 지연이 길수록 자주 겪는다는 문의 양상과 맞고(기본 지연 300ms에서는 안 걸림), 두세 통은 maxAttempts 재시도로 설명됨. 실험: deadline.js와 key.js를 바꾸면 해당 테스트가 통과.
- 사람 추정 판정: 없음 (intent 추가 의견 없음)
- 기각한 가설: 없음. 팀 지식(성공한 발송은 느려도 실패 아님)은 가설로 먼저 확인했고 deadline.js에서 같은 유형임을 코드로 확인함.

## 변경 요약
- src/digest/deadline.js — 성공한 발송은 경과 시간과 무관하게 값을 돌려주고 timeout 예외를 던지지 않는다. 실패는 fn의 오류 그대로 전파되어 재시도 유지. 걸린 시간은 digest.send.ms 지표로 계속 남는다.
- src/digest/key.js, src/digest/runner.js — 키를 `digest:기간:사용자`로 바꿔(runId 제거) 다른 실행에서도 이미 보낸 요약을 건너뛴다. 실행별 집계는 기록의 runId로 그대로 가능(runSummary).
- test/digest.test.js — 회귀 테스트 3개 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 마지막 3개 (느린 성공 한 통+sent 기록 / 같은 기간 재실행 / 느리고 실패한 발송의 재시도)
- 수정 전: 실패 (`node --test` → not ok 33, 34, 35; pass 74 fail 3)
- 수정 후: 통과 (`npm test` → pass 77 fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 77개 통과, 0 실패
- 실패 항목: 없음
