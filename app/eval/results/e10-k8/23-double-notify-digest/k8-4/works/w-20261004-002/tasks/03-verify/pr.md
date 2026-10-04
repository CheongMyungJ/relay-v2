# fix: 요약 메일 중복 발송 수정 (느린 성공 재발송, 재실행 키, 동시 실행)

## 요약
아침 요약 메일이 같은 날 고객에게 2~3통 나가던 문제를 고친다. 재시도 기능은 그대로 두고, 실제 실패한 발송은 계속 재발송한다.

## 원인
- `withDeadline`이 성공한 발송도 `sendTimeoutMs`(3000ms)를 넘기면 timeout 오류로 던져, 이미 나간 메일을 runner가 재시도했다.
- `digestKey`에 runId가 들어 있어 재실행·수동 실행마다 키가 달라 `ledger.has`가 중복을 못 막았다.
- (리뷰에서 발견) 확인과 기록 사이의 await 때문에 겹쳐 도는 실행이 같은 키를 동시에 보낼 수 있었다.

## 변경
- `src/digest/deadline.js`: 성공은 걸린 시간과 무관하게 성공. 제한 시간은 실패한 발송에만 적용(SendError는 그대로 던짐).
- `src/digest/key.js`, `runner.js`: 키를 `digest:기간:사용자`로(runId 제거). 실행별 집계는 ledger 항목의 runId로.
- `src/digest/runner.js`: 진행 중 키(`inFlight`)로 동시 실행의 중복 발송 방지.
- `docs/knowledge/retry/digest-key-includes-run-id.md`: 팀 지식 갱신.

## 테스트
- `npm test`: 79 pass / 0 fail (기준 커밋 74).
- 추가 테스트 5건: 느린 성공, 재실행(runId 다름), 실패 후 재실행으로 한 번 전달, 느린 실패 재시도 후 한 번 전달, 동시 실행. 앞의 세 건과 동시 실행 건은 수정 전 코드에서 실패한다.
- 알려진 한계: 발송 기록은 메모리(운영은 공유 DB 가정), 보낸 키는 3일 뒤 만료된다.
