## 재현
- 재현 절차: 가상 시계로 요약 대상 알림 1건을 모은 뒤 서울 08시 이후로 시계를 옮기고 `notifier.digest.tick()`. 아래를 각각 실행한다(`test/digest-duplicate.test.js`).
  1. 메일 transport 첫 호출이 5000ms 걸려 성공(`{ latencyMs: 5000 }`)
  2. 첫 호출이 메일은 나갔는데 ETIMEDOUT(`{ fail: 'timeout', delivered: true }`)
  3. 같은 기간을 runId만 바꿔 `digest.run` 두 번
  4. 서버 두 대(발송 기록 별개)가 같은 메일 서버로 발송
- 결과: 재현됨
- 기대: 수신자당 하루 한 통(`mail.sent.length === 1`), 성공이면 ledger에 sent
- 실제(기준 코드): 1) 호출 2번, sent 없이 retry 기록. 2) 같은 메일 2통. 3) 재실행마다 다시 발송. 4) 2통.

## 원인
- 원인: (a) `withDeadline`이 성공한 발송도 걸린 시간이 sendTimeoutMs(3000)를 넘으면 SendTimeoutError를 던져 markSent 없이 재시도로 이어진다. (b) 발송 기록 키에 runId가 들어가 실행·서버마다 키가 달라 이미 보낸 요약을 못 알아본다. (c) 메일 서버는 응답이 늦어도 받은 메일은 보내므로, 어댑터의 실제 ETIMEDOUT 뒤 재시도도 같은 메일임을 알릴 수단(고정 Message-ID)이 없었다.
- 근거: src/digest/deadline.js:15-19(성공 뒤 throw), src/digest/key.js:8(runId 포함), src/digest/runner.js:39/50, src/adapters/mail.js:41(ETIMEDOUT→재시도 대상). 기준 코드에서 새 테스트 5개 실패(위 재현). 팀 지식 successful-send-is-never-timeout.md의 유형과 일치함을 이 코드에서 확인했다.
- 사람 추정 판정: 없음 (추가 지시: timeout 경로도 범위, 재시도는 유지, 멱등 키 예시 — 아래 수정에 반영)
- 기각한 가설: 재시도 자체를 끄거나 timeout을 영구 오류로 취급 — 제약(실제 실패는 재시도)과 사람 지시에 어긋남.

## 변경 요약
- src/digest/deadline.js — 성공은 경과 시간과 무관하게 성공. 예외 대신 `slow` 플래그만 돌려줌.
- src/digest/key.js — 키를 `digest:기간:사용자`로(runId 제거). `digestMessageId` 추가: 기간+사용자 고정 Message-ID.
- src/digest/message.js — 요약 메일 헤더에 `Message-ID` 추가.
- src/digest/runner.js — 새 키 사용, slow 지표(`digest.send.slow`). 실패 재시도 로직은 그대로.
- src/adapters/fake-transports.js — 테스트용: Message-ID 중복 제거(중계 서버 흉내)와 `delivered: true` 옵션(나갔는데 timeout) 추가. 기존 동작은 Message-ID가 없을 때 동일.
- 기존 테스트 변경 없음.

## 재현 테스트
- 위치: test/digest-duplicate.test.js (6개: 키, 느린 성공, timeout 후 재시도(이미 나감), timeout 실제 실패 후 재시도, 재실행, 서버 두 대)
- 수정 전: 실패 — 기준 커밋 src에서 `node --test test/digest-duplicate.test.js`: 6개 중 5개 실패(fake-transports는 새 옵션 필요해 수정본 사용)
- 수정 후: 통과 — `npm test` 80개 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 80 통과, 0 실패
- 실패 항목: 없음
