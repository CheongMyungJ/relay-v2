## docs/knowledge/slow-success-is-success.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 응답이 제한 시간보다 늦어도 성공한 발송은 성공이다

- 종류: 규칙
- 적용: src/retry/policy.js(decide), src/digest/deadline.js(withDeadline), src/digest/runner.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

발송 결과는 성공 여부(`outcome.ok`)를 먼저 보고, 걸린 시간은 실패한 발송의 분류에만 쓴다.
- 맞음: 2500ms 걸려 성공한 발송(제한 2000ms) → 성공 처리, 재시도 없음. 느림은 `digest.send.slow` 같은 지표로만 본다.
- 틀림: 성공했는데 제한 시간을 넘겼다고 `timeout`으로 보고 재시도하거나 예외를 던진다 → 이미 전달된 알림이 두 번, 세 번 나간다.
- 실제 실패(transient, timeout 오류)는 기존 정책대로 재시도한다. 재시도 자체를 끄는 것은 해법이 아니다.
- 일반 발송(메일·푸시)과 요약 메일 모두 해당한다.
