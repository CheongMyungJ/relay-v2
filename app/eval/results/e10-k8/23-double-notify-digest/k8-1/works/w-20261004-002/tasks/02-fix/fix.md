## 재현
- 재현 절차: 수정 전 코드에 새 테스트만 얹어 `npm test` 실행 (`test/digest.test.js` 끝의 4개). 예: 메일 지연 3500ms(> `digest.sendTimeoutMs` 3000)로 `notifier.digest.tick()`, 같은 기간을 `digest.run({period, runId})`로 runId만 바꿔 두 번 실행.
- 결과: 재현됨
- 기대: 같은 기간·사용자의 요약은 `mail.sent.length === 1`
- 실제: 늦은 성공은 `mail.calls`가 2~3회(sent 여러 통), runId만 다른 재실행은 요약이 한 통 더 나감

## 원인
- 원인: 두 가지가 겹쳤다. (1) `withDeadline`이 발송이 성공한 뒤 걸린 시간이 제한을 넘으면 `SendTimeoutError`(transient)를 던져, 이미 나간 메일을 실패로 보고 재시도해서 최대 3통(maxAttempts) 전달됨. (2) 중복 방지 키 `digestKey`에 runId가 들어 있어(`src/digest/key.js`) 같은 기간을 다른 runId로 다시 돌리면(runId 기본값은 시각 포함 → 재실행/재시작/수동 실행마다 달라짐) 보낸 기록을 못 찾고 다시 보냄.
- 근거: `src/digest/deadline.js` 의 `elapsedMs > timeoutMs` 후 throw, `runner.js`의 catch가 transient면 `again`에 넣음. 메일은 느려(기본 300~400ms, 지연 시 3초 초과) 푸시보다 자주 드러남. 실험: 수정 전 4개 테스트 실패, 수정 후 통과. 늦은 성공(지연 3500ms) 시 수정 전 calls=2 이상.
- 사람 추정 판정: 없음
- 기각한 가설: 스케줄러 `lastPeriod` 메모리 값 때문에 중복 — 이것만으로는 원인 아님. 재시작으로 초기화돼도 키에서 runId를 빼면 ledger가 막는다(운영에서는 공유 DB 전제). 원인 (2)에 흡수됨.

## 변경 요약
- src/digest/deadline.js — 값을 돌려줬으면 걸린 시간과 무관하게 성공으로 반환(팀 지식 late-success-is-success). 소요 시간은 `digest.send.ms` 지표로 남음. 실제 어댑터 오류는 그대로 runner에서 재시도.
- src/digest/key.js, src/digest/runner.js — 키를 `digest:{period}:{userId}`로 바꿔 어떤 실행에서든 같은 기간 요약은 한 번만 보냄. 실행별 집계는 ledger 기록의 runId로 유지(`runSummary`).
- 재시도 횟수·간격(`maxAttempts`, `retryDelayMs`)은 건드리지 않음.

## 재현 테스트
- 위치: test/digest.test.js (끝의 4개: 최초 발송 늦은 성공, 재시도, 다른 runId 재실행, 실패 후 재발송 → 한 번 전달)
- 수정 전: 실패 (`npm test` → 4 fail, 74 pass)
- 수정 후: 통과 (`npm test` → 78 pass, 0 fail)

## 테스트 실행
- 명령: npm test
- 결과: 78 pass, 0 fail
- 실패 항목: 없음
