# fix: 요약 메일 중복 발송 수정 (느린 성공 재시도, runId 키, 동시 실행, 서버 간 원장 공유)

## 요약
아침 요약 메일이 같은 날 두 통, 가끔 세 통 나가던 문제를 고친다. 같은 기간의 요약은 수신자당 한 통만 나가고, 실제로 못 보낸 요약은 다시 보낸다.

## 원인
- 느리게 성공한 발송을 시간 초과로 보고 다시 보냄(`src/digest/deadline.js`)
- 원장 키에 runId가 들어 있어 다른 실행에서는 중복 방지가 안 됨(`src/digest/key.js`)
- 확인과 기록 사이에 await가 있어 동시 실행이 둘 다 보냄
- `createNotifier`가 원장을 안에서 만들어 서버 여러 대가 공유하지 못함(`src/notifier.js`)

## 변경
- `withDeadline`은 성공이면 던지지 않고 `slow`로만 알리고, `digest.send.slow` 지표를 올림
- 키를 `digest:기간:사용자`로 하고, 보내기 전 `ledger.claim`으로 선점, 못 보내면 `release`
- `createNotifier({ digestLedger })`로 공용 원장 주입. `claim`은 서버 간에도 원자적이어야 함(운영은 insert-if-absent)
- 선점 이후 메시지 생성이 던져도 선점이 풀리게 `try` 안으로 이동
- `docs/knowledge/delivery/`에 지식 항목 추가

## 테스트
- `npm test` 84개 통과
- `src/notifier.js`의 주입만 되돌리면 공용 원장 테스트 4개 실패
- 추가: 느린 성공, 다른 runId 재실행, 동시 실행, 실패 후 재발송, 서버 두 대(1분·30분·동시·실패 후 다른 서버)
- 한계: 선점 만료(lease)는 정하지 않음, 실제 DB 원장은 없음
