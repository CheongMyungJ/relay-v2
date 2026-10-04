## t-01 intake — 2026-10-04 05:11 (사람 승인)
- [사람] 범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외 — 요청 원문: batch.test.js는 따로 고쳐 리뷰 중
- [사람] 병렬 4개 유지, 재시도/skip/시간 늘리기 금지를 제약과 완료조건에 반영 — 팀 지식 flaky-test-policy.md의 규칙

## t-02 fix — 2026-10-04 05:13 (자동 승인)
- [AI] 임시 파일 이름을 reportId와 호출마다 늘어나는 번호로 고유하게 하고, runPool 결과를 입력 순서로 저장 — 팀 지식 docs/knowledge/batch/parallel-ordering-and-temp-names.md의 사실을 현재 코드에서 확인한 뒤 따름. 병렬 4개 유지와 재시도 금지 규칙(flaky-test-policy.md)도 지킴

## t-03 verify — 2026-10-04 05:15 (사람 승인)
- [사람] 리뷰 지적 1, 2를 모두 반영하기로 함 (2는 코드 변경 없이 위험으로 기록) — 사람이 '모두 반영'을 선택
