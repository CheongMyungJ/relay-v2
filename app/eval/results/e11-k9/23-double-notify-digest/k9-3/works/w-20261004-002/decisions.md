## t-01 intake — 2026-10-04 09:12 (사람 승인)
- [AI] 완료조건에 '성공 후 재발송 없음'과 '실제 실패는 재발송' 테스트 두 항목을 넣는다 — 요청의 '실제로 못 보낸 요약은 다시 보내야 한다'와 팀 규칙(real-failures-must-be-resent)

## t-02 fix — 2026-10-04 09:13 (자동 승인)
- [AI] 느린 성공은 성공으로 보고, 제한 시간 초과는 slow 표시와 지표·로그로만 남긴다 — 팀 지식 docs/knowledge/delivery/success-beats-timeout.md: 성공 판정은 걸린 시간보다 앞선다
- [AI] 요약 키에서 runId를 빼고 실행별 집계는 ledger 기록의 runId로 한다 — 팀 지식 docs/knowledge/delivery/success-beats-timeout.md: 매번 달라지는 값을 키에 넣지 않는다
- [AI] 재시도는 그대로 두고, 성공 후 재발송 없음과 실제 실패 재발송을 둘 다 테스트한다 — 팀 지식 docs/knowledge/delivery/real-failures-must-be-resent.md

## t-03 verify — 2026-10-04 09:18 (사람 승인)
- [사람] 메일 어댑터 응답 timeout도 중복의 원인으로 보고 요약 runner에서 보낸 것으로 처리한다(재발송 안 함). 진짜 실패(transient 등)는 계속 재시도한다 — 메일 서버 담당자 말: 응답이 늦어도 서버가 받은 메일은 모두 나간다. 사람이 이 경로도 고치라고 요청함
- [AI] ECONNRESET은 timeout에서 빼고 transient 실패로 재시도한다 — 연결이 끊긴 것은 서버가 메일을 받았다고 볼 수 없어 사람이 말한 근거(응답만 늦은 경우)에 해당하지 않음
- [사람] 가짜 메일 전송의 timeout은 메일을 내보내고(sent에 timedOut) 오류를 던지게 한다 — 사람이 요청: 페이크가 timeout에 메일을 보낸 것으로 흉내 내도록
- [사람] 리뷰 지적 2(사소, digest.slow 지표 단언)는 반영하지 않는다 — 사람이 반영하지 않아도 된다고 답함
