## t-01 intake — 2026-10-03 12:10 (사람 승인)
- [AI] 청구서의 줄별 버림 부가세 규칙을 반품 전표에도 적용하는 것으로 intent를 쓴다 — 팀 규칙 vat-floor-per-line이 '합계 반올림은 틀리다'고 하고, 요청도 환불이 회계팀 계산과 몇 원씩 안 맞는다는 내용이다

## t-02 fix — 2026-10-03 12:11 (자동 승인)
- [AI] 반품 전표 부가세를 과세 줄마다 버림해서 합한다 — 팀 지식 docs/knowledge/vat-floor-per-line.md와 intent 제약
- [AI] 청구서 계산(src/invoice/total.js)은 바꾸지 않는다 — intent 비목표. 청구서는 이 브랜치에서 아직 Math.round 방식이다

## t-03 verify — 2026-10-03 12:12 (사람 승인)
- [사람] 리뷰 지적 2건(모두 사소)을 반영하지 않는다 — 사람이 '반영하지 않음'을 고름
- [AI] docs/knowledge/credit-note-vat-separate-copy.md를 반품 전표도 줄별 버림으로 맞췄다는 내용으로 갱신 — 기존 항목이 '전표는 합계 반올림 그대로'라고 적혀 있어 이 Work 이후 사실과 다르다
