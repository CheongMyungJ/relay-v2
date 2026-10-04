## t-01 intake — 2026-10-03 12:17 (사람 승인)
- [AI] 배치 병렬 동시 4개 유지와 재시도/skip/timeout 증가 금지를 제약에 넣는다 — 팀 지식의 사람이 정한 규칙이며 이번 경우(간헐 실패, 시험 흔들림)에 해당한다
- [사람] ci/batch.test.js 간헐 실패는 비목표로 둔다 — 요청에서 별도 Work로 리뷰 중이라고 명시함

## t-02 fix — 2026-10-03 12:19 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣는 방식으로 고친다 (순차화, 재시도, timeout 증가는 쓰지 않음) — 팀 지식 docs/knowledge/archive-tmp-name-needs-unique-part.md, no-retry-skip-timeout-for-flaky-tests.md, batch-keeps-parallel-concurrency-4.md

## t-03 verify — 2026-10-03 12:21 (사람 승인)
- [AI] 리뷰 지적 없음, 반영할 것 없음 — 수정이 원인(임시 파일 이름 충돌)을 직접 고치고 비목표를 건드리지 않음
- [사람] 고객사 불일치(wayne/stark) 증상도 이 수정으로 해결되는지 확인했고 fix로 돌아가지 않는다 — 기준 커밋 40회에서 ENOENT 8회와 고객사 불일치 2회가 나왔고 수정 후 60회는 0회. 같은 임시 파일 충돌이며 runPool 순서와 무관
- [사람] `npm run test:ci` 통과 조건은 실패로 두고 그대로 완료 화면으로 간다 — 실패 원인이 비목표인 ci/batch.test.js 간헐 실패
