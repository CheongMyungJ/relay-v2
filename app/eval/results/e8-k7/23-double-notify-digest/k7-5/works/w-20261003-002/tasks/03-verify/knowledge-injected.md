## docs/knowledge/digest-key-excludes-run-id.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 요약 중복 방지 키에는 runId를 넣지 않는다

- 종류: 실패 유형
- 적용: src/digest/key.js, src/digest/runner.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

요약의 보낸 키는 `digest:기간:사용자`다. runId를 넣으면 같은 기간을 재시작·수동 재실행할 때 키가 달라 이미 보낸 요약을 또 보낸다.
실행별 집계는 키가 아니라 발송 기록(ledger entry)의 runId 필드로 한다(`runSummary(runId)`).
키 형식을 바꾸면 배포 직후 옛 키(runId 포함)는 인식되지 않아 그 기간은 한 번 더 갈 수 있다.

## docs/knowledge/successful-send-never-retried-on-slow.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 성공한 발송은 느렸어도 재시도하지 않는다

- 종류: 규칙
- 적용: src/retry/policy.js, src/digest/deadline.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

발송이 성공(`outcome.ok`)이면 걸린 시간이 제한을 넘어도 이미 전달된 것이므로 재시도하지 않는다. 다시 보내면 고객에게 중복 알림이 간다(메일 3000ms/제한 2000ms 성공 건이 재시도 때 또 발송된 사례).
시간 초과가 재시도 사유가 되는 것은 어댑터가 시간 초과 오류(`SendTimeoutError`)를 던져 실제로 실패했을 때뿐이다.
요약 발송도 같다. 느린 성공은 오류로 바꾸지 않고 `slow`로만 알린다.
