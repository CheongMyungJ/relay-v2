## t-01 intake — 2026-10-03 13:04 (사람 승인)
- [AI] 동시성 유지, 재시도/skip/시간 제한 금지를 비목표와 제약에 넣음 — 팀 지식의 사람 규칙(keep-parallel-concurrency-4, no-retry-skip-timeout-for-flaky)이 이번 경우에 해당함

## t-02 fix — 2026-10-03 13:05 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣어 고친다. 동시성은 그대로 둔다 — 팀 지식 docs/knowledge/report-temp-file-name-must-be-unique.md, keep-parallel-concurrency-4.md. 이 코드에서 원인을 실험으로 확인함

## t-03 verify — 2026-10-03 13:07 (사람 승인)
- [사람] test:ci 완료조건이 실패(batch 간헐 실패)인 채로 Work 완료 화면으로 간다 — 실패한 시험은 비목표인 ci/batch.test.js이고 따로 고쳐 리뷰 중이다. 사람이 선택함
