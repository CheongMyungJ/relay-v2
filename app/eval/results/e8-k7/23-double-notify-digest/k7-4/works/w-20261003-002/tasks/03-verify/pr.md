# fix: 요약 메일 중복 발송 수정 (성공한 느린 발송 재시도 방지, 발송 키에서 runId 제거)

## 요약
아침 요약 메일이 같은 날 두세 통 나가던 문제를 고쳤다. 실패한 발송의 재시도는 그대로다.

## 원인
1. `withDeadline`이 성공한 발송도 3000ms를 넘기면 timeout 예외를 던져 markSent 없이 재시도됐다.
2. 발송 키에 runId가 들어 있어 재실행, 재시작, 서버 여러 대에서 이미 보낸 요약을 알아보지 못했다.

## 변경
- `src/digest/deadline.js`: 성공은 경과 시간과 무관하게 값을 돌려준다. 실패 오류는 그대로 전파한다.
- `src/digest/key.js`, `runner.js`: 키를 `digest:기간:사용자`로 바꿨다.
- `docs/knowledge/digest-key-excludes-run-id.md`: 팀 지식 추가.
- 일반 알림(`retry/policy.js`)은 비목표라 건드리지 않았다.

## 테스트
- `npm test`: 77개 통과.
- 회귀 테스트 3개 추가(느린 성공 한 통과 sent 기록, 같은 기간 재실행, 느리고 실패한 발송의 재시도). 수정 전에는 3개 모두 실패.
