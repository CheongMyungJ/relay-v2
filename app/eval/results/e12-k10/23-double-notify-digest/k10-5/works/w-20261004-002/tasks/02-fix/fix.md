## 재현
- 재현 절차: `test/digest.test.js`의 새 테스트 두 개를 수정 전 코드에서 `npm test`로 실행. (1) 메일 지연 3500ms(제한 3000ms 초과)로 `notifier.digest.tick()` 한 번, (2) 같은 기간을 `digest.run({period, runId})`로 runId만 바꿔 두 번 실행.
- 결과: 재현됨
- 기대: 수신자당 1통
- 실제: (1) 사용자 1명에게 3통(maxAttempts 3). (2) 사용자 2명 × 3번 실행 = 6통(기대 2통)

## 원인
- 원인: 두 가지가 겹친다. ① `withDeadline`이 어댑터가 성공한 뒤에도 걸린 시간이 제한을 넘으면 `SendTimeoutError`를 던져, 이미 나간 메일을 일시적 오류로 보고 재시도한다(최대 3통). 성공이 기록(`markSent`)되지 않으므로 재시도마다 다시 나간다. ② `digestKey`에 runId가 들어 있어 재시작·서버 여러 대 등 다른 runId로 같은 기간을 다시 돌리면 원장이 막지 못한다.
- 근거: `src/digest/deadline.js`(수정 전 15~18줄)가 `fn()` 성공 후 throw, `src/digest/runner.js`의 catch에서 `isTransient`(timeout은 transient)로 재시도. 수정 전 실패 출력 actual 3, actual 6. 수정 후 둘 다 통과(코드 변경으로 원인 제거 확인). 느린 메일(기본 지연 400ms는 제한 3000ms 미만, 큰 지연 시에만 발생)이라 "가끔"이라는 증상과 맞고, 3통은 maxAttempts=3과 일치.
- 사람 추정 판정: 없음
- 기각한 가설: 일정(scheduler)이 같은 기간을 두 번 돈다 — `lastPeriod`로 한 프로세스에서는 막히고 기존 테스트가 하루 한 번을 확인함. 다만 재시작 시 lastPeriod가 사라지므로 ②가 그 경우를 막는다.

## 변경 요약
- `src/digest/deadline.js` — 성공한 발송은 제한 시간을 넘겨도 던지지 않고 `slow: true`로 알린다. 실패 시 오류는 그대로 전파.
- `src/digest/runner.js` — `slow`이면 `digest.send.slow` 지표를 올린다. 키 생성에서 runId 제거.
- `src/digest/key.js` — 키를 `digest:기간:사용자`로 바꿈. 실행별 집계는 원장 항목의 runId로 계속 가능(`runSummary`).
- 실패한 발송은 `markSent`되지 않으므로 이후 실행과 재시도에서 다시 보내진다(건너뛰지 않음).

## 재현 테스트
- 위치: `test/digest.test.js` 새 테스트 3개 — 느린 성공 재시도 안 함 / 다른 runId로 재실행해도 한 통 / 실패한 요약은 다음 실행에서 재발송
- 수정 전: 실패 — `npm test`: 느린 성공 actual 3(기대 1), runId 재실행 actual 6(기대 2). 세 번째(재발송)는 수정 전에도 통과(회귀 방지용).
- 수정 후: 통과 — `npm test` 77개 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 77 통과, 0 실패 (기존 74개 변경 없음)
- 실패 항목: 없음
