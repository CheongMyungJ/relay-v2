## 재현
- 재현 절차: `npm test` — 이전 커밋의 todo 테스트 "원장을 따로 쓰는 서버 두 대가 같은 요약을 돌려도 한 통만 보낸다"(서버 둘이 각자 `notifier.digest.tick()`)
- 결과: 재현됨
- 기대: 수신자당 한 통
- 실제: 원장이 서버마다 따로라 서버 수만큼(2통) 발송

## 원인
- 원인: `createNotifier`가 요약 원장을 안에서 만들어(`src/notifier.js:70`) 밖에서 주입할 수 없어, 서버 둘이 서로의 선점(claim)과 발송 기록을 알지 못한다. 선점 자체(`ledger.claim`)는 확인과 선점 사이에 await가 없어 같은 원장 안에서는 원자적이다.
- 근거: 원장을 공유하는 이전 테스트(간격·동시)는 통과, 따로 쓰는 경우만 2통. 수정 전 코드에서 새 공용 원장 테스트 4개가 실패(주입 무시), 수정 후 통과.
- 사람 추정 판정: 없음
- 기각한 가설: 일정(scheduler) 중복 실행 — lastPeriod로 한 프로세스에서는 막히고, 서버 간 중복은 원장 공유 문제임

## 변경 요약
- `src/notifier.js` — `o.digestLedger` 주입 옵션 추가(없으면 기존대로 인스턴스 메모리 원장).
- `src/digest/ledger.js` — `claim`이 서버 간에도 원자적이어야 한다는 계약을 주석에 명시(운영 저장소는 insert-if-absent).
- (기존 테스트 변경) `test/digest.test.js` — 러너를 직접 조립하던 `twoServers`를 공용 원장 주입 방식으로 바꾸고 todo 테스트를 "원장을 따로 쓰면 서버마다 보낸다"는 대조 테스트로 교체. 기존 공유 원장 테스트(1분/30분/동시)는 `tick()` 기반 주입 방식으로 옮겼고 단언(총 2통, already 2)은 같다.
- `test/helpers.js` — `setup`이 `clock`, `digestLedger`를 받음.
- `docs/knowledge/delivery/digest-key-includes-run-id.md` — 공용 원장 주입 규칙 반영.

## 재현 테스트
- 위치: `test/digest.test.js` "공용 원장을 주입한 서버 두 대…" (1분, 30분 간격, 동시), "보내지 못해도 선점이 풀려 다른 서버가 다시 보낸다"(실패 요약 재발송), 대조 테스트
- 수정 전: 실패 — `src/notifier.js`만 되돌려 `npm test`: 4개 실패(80 통과)
- 수정 후: 통과 — `npm test` 84개 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 84개 통과, 실패 0, todo 0
- 실패 항목: 없음
