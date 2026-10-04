## docs/knowledge/no-disable-retry-for-duplicates.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 중복 발송은 재시도를 끄는 것으로 고치지 않는다

- 종류: 규칙
- 적용: src/retry/, src/digest/ (재시도·재발송 경로 전반)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

같은 알림이 두 번 가는 문제를 재시도 횟수를 줄이거나 재시도를 꺼서 고치면 안 된다. 실제로 실패한 발송은 지금처럼 다시 보내야 한다.
- 맞다: 성공한 발송을 재시도 대상에서 빼기 (성공 판정이 시간 초과 판정보다 먼저)
- 틀리다: maxAttempts를 1로 하기, 재시도 큐 끄기, 간격 늘려 가리기

## docs/knowledge/slow-success-is-not-failure.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 느리게 성공한 발송을 실패로 취급하면 같은 알림이 2~3통 간다

- 종류: 실패 유형
- 적용: src/retry/policy.js(decide), src/digest/deadline.js, src/digest/key.js (관련 위치)
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

발송이 성공(도착)했는데 걸린 시간이 제한 시간(send.timeoutMs 기본 2000ms, digest.sendTimeoutMs 기본 3000ms)을 넘었다고 실패로 보고 재시도하면 중복이 된다. 최대 시도 3회라 최대 3통이다.
- 성공 여부를 먼저 보고, 느림은 지표(slow)로만 남긴다.
- 요약 발송의 이미 보냈는지 키에는 실행마다 바뀌는 값(runId)을 넣지 않는다. 넣으면 재실행 때 중복 확인이 무효가 된다.
- 재시도 간격이 첫 1초, 다음 2초(baseDelayMs 1000, factor 2)라 중복 메일은 첫 메일 뒤 지연 시간+1초 안팎으로 온다.

## docs/knowledge/timeout-setting-change-before-duplicates.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

# 중복 발송 신고 무렵 운영의 발송 제한 시간 설정이 바뀌었다는 이야기가 있다

- 종류: 이력
- 적용: src/config/defaults.js, 환경 변수 NOTIFY_SEND_TIMEOUT_MS / NOTIFY_DIGEST_SEND_TIMEOUT_MS
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

사람 말: 지난주 배포에서 발송 제한 시간 설정이 바뀌었다는 얘기가 있고, 중복 메일의 두 번째는 첫 번째보다 3~4초 늦게 온다. 설정 이력은 이 레포에 없어 운영 값은 확인하지 못했다(미확인).
- 제한 시간이 낮아졌다면 평소 지연으로도 중복이 생기므로 "느릴 때만 생긴다"는 가정을 믿지 말고 운영의 실제 설정값을 먼저 확인한다.
- 3~4초 간격은 재시도 지연 1초(backoffDelay)와 첫 발송 지연의 합으로 설명되어 코드 원인과 맞는다.
