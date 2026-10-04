## 재현
- 재현 절차: `test/digest.test.js`의 새 테스트 두 개를 수정 전 코드에서 실행 (`npm test`). 1) 메일 지연 5000ms(제한 3000ms)로 `notifier.digest.tick()`, 2) 같은 기간을 `digest.run({period, runId:'run-1'})`, `run-2`로 두 번 실행.
- 결과: 재현됨
- 기대: 고객당 메일 1통 (`mail.sent.length === 1`)
- 실제: 1) 느린 성공이 시간 초과로 처리돼 3번 시도, 최대 3통. 2) 두 번째 실행이 다시 발송해 2통.

## 원인
- 원인: (A) `withDeadline()`이 성공한 발송이라도 걸린 시간이 `sendTimeoutMs`를 넘으면 `SendTimeoutError`(transient)를 던져, 이미 전달된 요약을 runner가 재시도한다(최대 3회 = 2~3통). (B) `digestKey`에 `runId`가 들어 있어 이미 보낸 키 검사가 실행 사이에서 작동하지 않는다. 재시작으로 scheduler의 `lastPeriod`가 비거나 수동 재실행, 서버 여러 대일 때 같은 요약이 또 나간다.
- 근거: `src/digest/deadline.js:17`(수정 전)의 성공 뒤 시간 검사 throw, `src/digest/key.js:8`(수정 전)의 `runId` 포함. 수정 전 새 테스트 2개 실패, 수정 후 통과. 메일 기본 지연 300~400ms는 제한 안이라 평소에는 드물고, SMTP 중계가 3초 넘게 느릴 때만 걸려 "가끔 세 통"과 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 횟수/재시도 끄기로 해결 — 제약(실패한 발송은 재시도)에 어긋나 기각. 푸시 등 다른 경로 — 요약은 `adapters.mail`만 쓴다(`src/notifier.js:73`)라 해당 없음.

## 변경 요약
- src/digest/deadline.js — 성공 결과를 시간 초과 오류로 바꾸지 않고 `slow` 플래그만 돌려줌. fn이 던진 오류(ETIMEDOUT 등)는 그대로.
- src/digest/key.js — 키를 `digest:{period}:{userId}`로 바꿈(runId 제거). 실행별 건수는 ledger 기록의 runId로 센다.
- src/digest/runner.js — 키 호출 수정, 느린 성공은 `digest.slow` 지표와 경고 로그만 남김.

## 재현 테스트
- 위치: test/digest.test.js (추가 4개: 느린 성공 1회, 다른 실행 재실행 1회, 실패(소켓 시간 초과·일시 오류) 재시도 후 1회 전달, 영구 오류 뒤 재실행 가능=하루 건너뛰기 없음)
- 수정 전: 실패 — `npm test`: 새 테스트 2개(느린 성공, 다른 실행) fail, 나머지 2개는 기존 동작 보호용이라 통과 (pass 76 / fail 2)
- 수정 후: 통과 — `npm test`: pass 78 / fail 0
- 경로별 근거: 요약 발송 경로는 메일 하나뿐이다(runner는 `adapters.mail`만 사용). 메일 경로의 고객 수신 1회는 위 테스트 4개로 확인. 푸시로는 요약이 나가지 않는다(코드 확인, 즉시 알림만 push).

## 테스트 실행
- 명령: `npm test`
- 결과: 78개 통과, 0 실패 (기존 테스트 변경 없음)
- 실패 항목: 없음
