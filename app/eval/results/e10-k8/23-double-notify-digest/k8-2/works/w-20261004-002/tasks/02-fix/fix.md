## 재현
- 재현 절차: `node --test test/no-double-send.test.js` (수정 전 코드에서). 요약 사용자 1명, 가상 메일 전송 지연 3500ms(제한 `digest.sendTimeoutMs` 3000ms)로 `notifier.digest.tick()` 실행. 두 번째 시나리오는 같은 기간에 `notifier.digest.run({ period })`를 두 번 호출.
- 결과: 재현됨
- 기대: 메일 1통
- 실제: 느린 성공 시 3통(`mail.sent.length` 3), 같은 기간 재실행 시 2통

## 원인
- 원인: (1) `withDeadline`이 발송이 성공한 뒤 걸린 시간이 제한을 넘으면 `SendTimeoutError`(transient)를 던져, 이미 전달된 요약을 실패로 보고 재시도한다(maxAttempts 3 → 최대 3통). 이때 `markSent`가 호출되지 않아 중복 방지 키도 남지 않는다. (2) `digestKey`에 `runId`(기본값은 실행 시각)가 들어 있어, 같은 기간을 다시 실행하면(재시작, 다중 서버 등) 키가 달라 중복 방지가 작동하지 않는다.
- 근거: `src/digest/deadline.js`의 `elapsedMs > timeoutMs` 검사 후 throw, `src/digest/key.js`의 키 형식. 수정 전 테스트 실패 출력(3통, 2통). 지연이 제한 이하(300ms)면 재현되지 않음(기존 테스트 통과) — 재현 조건(느린 SMTP 중계)과 일치. 두 수정을 적용하자 테스트가 통과함. 각 수정을 따로 적용하는 실험은 하지 않음.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 로직 자체가 문제 — 기각. 실제 오류(ETIMEDOUT, 421)는 재시도로 전달돼야 하며 재시도는 그대로 둠.

## 변경 요약
- `src/digest/deadline.js` — 제한 시간을 넘겨도 성공 결과를 오류로 바꾸지 않고 `elapsedMs`만 돌려줌.
- `src/digest/key.js`, `src/digest/runner.js` — 발송 기록 키에서 `runId` 제거(`digest:{period}:{userId}`). 실행별 건수는 entries의 `runId`로 계속 센다.
- `test/no-double-send.test.js` — 회귀 테스트 3개 추가.

## 재현 테스트
- 위치: `test/no-double-send.test.js`
- 수정 전: 실패 — `node --test test/no-double-send.test.js`: 테스트 1(3통), 2(2통) 실패, 3(실제 오류 재시도)은 통과
- 수정 후: 통과 — 3개 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 77개 중 77개 통과
- 실패 항목: 없음
