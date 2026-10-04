## 재현
- 재현 절차: `test/digest.test.js`에 추가한 세 테스트를 수정 전 코드에서 `npm test`로 실행. (1) 메일 첫 발송이 4000ms 걸려 성공(제한 3000ms), (2) 같은 날짜를 runId만 바꿔 두 번 `digest.run`, (3) transient 실패 + 4초 걸린 timeout 실패 뒤 재실행.
- 결과: 재현됨
- 기대: 요약 메일은 같은 날짜·사용자에게 성공 한 통. 실제 실패만 재시도.
- 실제: (1) 성공했는데 `mail.calls`가 2번, 고객에게 2통. (2) 재실행하면 `already`가 0이고 한 통 더 감.

## 원인
- 원인: 두 가지가 겹친다. ① `withDeadline`이 발송에 성공했어도 3초를 넘으면 `SendTimeoutError`(transient)를 던져 runner가 이미 간 요약을 실패로 보고 다시 보낸다(최대 maxAttempts=3통). ② `digestKey`에 실행마다 달라지는 `runId`(기본값은 실행 시각)가 들어가 있어, 같은 기간을 다시 실행하면 발송 기록에서 이미 보낸 요약을 알아보지 못한다.
- 근거: `src/digest/deadline.js`(수정 전 줄 19~21)의 throw와 `src/digest/runner.js`의 `isTransient` 재시도 분기. `src/digest/key.js:8`의 `${runId}`. 수정 전 새 테스트 3개 실패, 수정 후 전체 77개 통과. 두 원인 각각이 따로 중복을 만든다는 것은 테스트 (1)과 (2)가 서로 다른 경로로 실패하는 것으로 확인. 한 통만 가는 조건(빠른 성공, 한 번만 실행)과도 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 횟수·간격 문제 — 실제 실패 재시도 테스트가 이미 통과하고, 중복은 성공 뒤에 생기므로 기각. 재시도를 끄는 것은 제약상 해결이 아님.

## 변경 요약
- src/digest/deadline.js — 제한 시간을 넘겨도 던지지 않고 `slow`만 돌려준다. 성공은 걸린 시간과 무관하게 성공. 실패는 fn의 오류 그대로 전달.
- src/digest/runner.js — 키에서 runId 제거, 느린 성공은 `digest.slow` 지표와 경고 로그로 남김.
- src/digest/key.js — 키를 `digest:{period}:{userId}`로. 실행별 집계는 ledger 기록의 `runId`로 가능(`runSummary`는 그대로 동작).

## 재현 테스트
- 위치: test/digest.test.js 끝의 세 테스트 (느린 성공 후 재발송 없음 / 재실행해도 재발송 없음 / 실제 실패는 재시도하고 재실행해도 한 통)
- 수정 전: 실패 (`npm test` → fail 3, 74 pass)
- 수정 후: 통과 (`npm test` → pass 77, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 77개 통과, 0개 실패 (기존 74개는 수정하지 않음)
- 실패 항목: 없음
