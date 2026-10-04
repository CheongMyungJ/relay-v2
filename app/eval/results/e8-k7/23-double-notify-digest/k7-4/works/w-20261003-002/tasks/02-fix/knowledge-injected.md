## docs/knowledge/successful-send-is-never-timeout.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 성공한 발송은 느렸어도 실패로 보지 않는다

- 종류: 실패 유형
- 적용: src/retry/policy.js decide(), src/digest/deadline.js withDeadline()
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

어댑터 호출이 성공했는데 걸린 시간이 제한 시간(일반 send.timeoutMs 2000ms, 요약 digest.sendTimeoutMs 3000ms)을 넘었다고 실패(timeout)로 보면 재시도로 같은 알림이 다시 나가 중복(두 번, 가끔 세 번)이 된다. 메일은 지연이 길어 더 자주 겪는다.
- 맞음: 성공(`outcome.ok`)은 경과 시간과 무관하게 완료로 본다.
- 틀림: 성공 뒤 경과 시간만으로 timeout 처리하거나 예외를 던진다(요약은 markSent 전에 예외가 나 기록도 남지 않는다).
- 실패한 발송은 제한 시간을 넘겨도 지금처럼 재시도한다.
