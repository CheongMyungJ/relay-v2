## 재현
- 재현 절차: 수정 전 코드에서 `test/digest.test.js`에 추가한 경로별 테스트를 `node --test test/digest.test.js`로 실행(메일 가짜 전송의 `outcomes: [{ latencyMs: 3500 }]`로 느린 성공을, `run()`을 runId를 달리 두 번 불러 스케줄러 재실행을 흉내 냄).
- 결과: 재현됨
- 기대: 같은 날짜 요약은 고객당 한 통(`mail.sent`가 1건), 실패한 요약만 재발송.
- 실제: 느린 성공은 `mail.calls`가 2건(성공한 메일을 시간 초과로 보고 재시도), 재실행은 받은 사람에게도 또 발송(2건), 첫 실행에서 실패한 사람은 재실행 때 재발송되지만 받은 사람도 함께 재발송됨.

## 원인
- 원인: 중복 경로가 두 개다. (1) `withDeadline`이 이미 성공한 발송을 제한 시간(3000ms)을 넘겼다는 이유로 `SendTimeoutError`로 바꿔 던져, runner가 일시적 오류로 보고 같은 요약을 다시 보낸다(최대 3통). (2) `digestKey`에 `runId`가 들어 있어 실행마다 키가 달라지므로, 같은 기간을 다시 돌리면(프로세스 재시작으로 `lastPeriod`가 사라진 스케줄러, 수동 재실행) 발송 기록의 "이미 보냄" 확인이 통하지 않는다.
- 근거: `src/digest/deadline.js` 수정 전 `if (elapsedMs > timeoutMs) throw new SendTimeoutError`, `src/digest/key.js` 수정 전 `digest:${period}:${runId}:${userId}`, `src/digest/scheduler.js`의 `lastPeriod`는 메모리 값. 수정 전 새 테스트 5건 실패(느린 성공 2, 재실행 2, 재발송 1), 수정 뒤 모두 통과 — 각 원인을 따로 되돌려 보는 실험은 하지 않았지만 두 수정이 각각 서로 다른 테스트 묶음을 고침. 메일은 SMTP 지연 때문에 느린 성공이 더 잦다(팀 지식 `success-before-timeout.md`와 같은 유형, 이 브랜치 코드에서 확인함).
- 사람 추정 판정: 없음
- 기각한 가설: 같은 날 이벤트가 요약함에 두 번 담김 — `inbox.add`가 `source/id`로 막고 기존 테스트가 이를 확인. 스케줄러가 한 프로세스에서 하루 두 번 돎 — `lastPeriod`를 await 전에 동기적으로 정해 같은 프로세스에서는 막힘.

## 변경 요약
- src/digest/deadline.js — 성공한 발송은 느려도 성공으로 돌려주고 `slow` 표시만 한다(시간 초과 오류는 발송 쪽이 던진 것만).
- src/digest/key.js — 키에서 `runId` 제거(`digest:${period}:${userId}`). 실행별 건수는 기록(ledger)의 `runId`로 그대로 센다.
- src/digest/runner.js — 새 키 사용, 느린 성공은 `digest.slow` 지표와 경고 로그만 남김.
- test/digest.test.js — 경로별 테스트 7건 추가(기존 테스트는 바꾸지 않음).

## 재현 테스트
- 위치: test/digest.test.js 끝부분(`[첫 발송]`, `[느린 성공]`, `[느린 성공이 반복]`, `[실패 후 재시도]`, `[스케줄러 재실행]` 2건, `[재발송]`)
- 수정 전: 실패 (`npm test` → 81건 중 5건 실패: 느린 성공, 느린 성공이 반복, 스케줄러 재실행 2건, 재발송)
- 수정 후: 통과 (`npm test` → 81건 통과, 실패 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 81건 통과, 0건 실패
- 실패 항목: 없음 (기준 커밋에서는 74건 모두 통과)
