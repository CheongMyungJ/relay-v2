## t-01 intake — 2026-10-04 09:11 (사람 승인)
- [사람] ci/batch.test.js는 비목표로 둔다 — 요청에서 따로 고쳐 리뷰 중이라 이번 범위가 아니라고 함

## t-02 fix — 2026-10-04 09:14 (자동 승인)
- [AI] 임시 파일 이름에 reportId를 넣는 것으로 고친다 — docs/knowledge/store/temp-file-unique-name.md 규칙과 같고 재시도·skip·순차화 없이 근본 원인을 고침
- [AI] ci/batch.test.js의 간헐 실패(runPool 순서)는 고치지 않는다 — intent의 비목표

## t-03 verify — 2026-10-04 09:16 (사람 승인)
- [사람] test:ci 완료조건은 판정 불가로 두고 완료 화면으로 진행한다 — 실패가 모두 비목표인 ci/batch.test.js에서 났고 이 Work에서 고칠 수 없음. 사람이 완료 화면 진행을 고름
