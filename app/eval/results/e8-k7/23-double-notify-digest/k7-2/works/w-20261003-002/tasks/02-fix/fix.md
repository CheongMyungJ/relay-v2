## 재현
- 재현 절차: `npm test -- test/digest.test.js` (수정 전 커밋에 `test/digest.test.js` 끝의 새 테스트만 얹어 실행). 가상 시계로 요약 메일을 보내고 수신 수를 센다.
  - 경로 1: 첫 발송이 3500ms 걸려 성공(제한 3000ms 초과) → `tick()`
  - 경로 2: 같은 기간을 `digest.run({ period })`로 두 번 실행(runId가 다름)
  - 경로 3: 느린 성공(4000ms) 뒤 재실행
- 결과: 재현됨
- 기대: 고객마다 같은 날 요약 한 통 (`mail.sent.length === 1`)
- 실제: 경로 1은 느린 성공 뒤 60초 뒤 재전송으로 2통(최대 3통). 경로 2·3은 재실행마다 새로 보내 중복. 새 테스트 5건 중 4건 실패(경로 1·2·3, 실패 뒤 재실행).

## 원인
- 원인: 요약 중복은 서로 다른 두 결함이 겹쳐 생긴다. (a) `withDeadline`이 발송이 성공한 뒤 걸린 시간만 보고 `SendTimeoutError`(transient)를 던져, 이미 도착한 요약을 실패로 보고 재시도한다. (b) 이미 보냈는지 키(`digestKey`)에 runId가 들어 있어, 재실행(새 runId)에서는 중복 확인이 항상 비어 있다.
- 근거: `src/digest/deadline.js` 기준 커밋 15~17행(성공 후 elapsed 검사 → throw), `src/digest/runner.js:57-61`(transient이고 attempt < maxAttempts면 again에 넣음), `src/digest/key.js:7`(`digest:${period}:${runId}:${userId}`), `runner.js:7`의 기본 runId는 실행 시각을 포함. 실험: 수정 전에 경로 1은 `mail.sent.length`가 2, 경로 2는 `second.sent`가 2로 실패했고, 두 수정 적용 뒤 모두 통과. 재현 조건 설명: 평소 지연(300ms)에서는 안 생기고 3초를 넘는 성공에서만 (a)가 생김. (b)는 프로세스 재시작(scheduler의 `lastPeriod`는 메모리), 수동 `digest.run`처럼 요약이 다시 나갈 수 있는 모든 경우에 생김. 재시도 간격이 `retryDelayMs` 60초라 두 번째 메일은 첫 메일 60초 뒤쯤에 옴(운영에서 신고된 3~4초 간격은 요약 경로가 아니라 일반 발송 경로(`policy.decide`, 1초 backoff)와 맞음 — 아래 참고).
- 사람 추정 판정: 없음 (intent `추가 의견`이 "없음")
- 기각한 가설:
  - 재시도 횟수·재시도 활성 설정을 줄이거나 끄기 — 비목표이자 팀 규칙(`no-disable-retry-for-duplicates`). `maxAttempts`, `retryDelayMs` 등 설정은 기준과 동일하게 둠.
  - 운영의 발송 제한 시간 설정이 바뀐 것이 원인 — 이 레포에서 운영 값을 확인할 수 없음(미확인). 제한 시간이 낮아지면 (a)가 평소 지연에서도 나타날 뿐 원인 구조는 같고, 수정 뒤에는 제한 시간과 무관하게 중복이 없다.
  - 중복 이벤트 수신(`deduper`)이나 요약함 중복 담기 — `inbox.add`가 `source/id`로 이미 거름(기존 테스트 통과).

## 변경 요약
- src/digest/deadline.js — 성공한 발송을 시간 초과 오류로 바꾸어 던지지 않고 `slow` 플래그만 돌려줌. 오류는 그대로 전파되므로 실제 실패는 재시도됨.
- src/digest/key.js — 키에서 runId 제거(`digest:${period}:${userId}`). 재실행에서도 이미 보낸 요약을 알아봄. 실행별 건수(`runSummary`)는 ledger 항목의 runId로 세므로 영향 없음.
- src/digest/runner.js — 키 호출 수정, 느린 성공은 `digest.slow` 지표와 경고 로그로만 남김.
- test/digest.test.js — 새 테스트 5건 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 끝 5건 (경로 1·2·3, 실제 실패 후 재시도 1회 전달, 실패 뒤 재실행은 못 받은 고객에게만)
- 수정 전: 실패 — `npm test` 결과 `# pass 75`, `# fail 4` (경로 1·2·3, 실패 뒤 재실행). "실제 실패 재시도" 테스트는 기준 동작을 지키는 회귀 테스트라 수정 전에도 통과.
- 수정 후: 통과 — `npm test` 결과 `# pass 79`, `# fail 0`

## 테스트 실행
- 명령: `npm test`
- 결과: 79건 통과, 0건 실패 (기준 커밋은 74건 통과)
- 실패 항목: 없음
