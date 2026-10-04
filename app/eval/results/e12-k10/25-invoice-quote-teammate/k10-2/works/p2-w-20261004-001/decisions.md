## t-01 intake — 2026-10-04 12:51 (사람 승인)
- [AI] 기대 합계를 56,278원으로 둔다 — 팀 지식 항목(vat-per-line-floor.md)에 Q-0457 합계 56,278원이 회계팀 기준으로 적혀 있음

## t-02 fix — 2026-10-04 12:52 (자동 승인)
- [AI] 청구서(total.js)의 같은 호출 오류도 함께 고친다 — 팀 지식 docs/knowledge/invoice/vat-per-line-floor.md: 세 문서가 lineVat을 함께 씀. 같은 원인이며 npm test 통과 조건에 필요
- [AI] credit-note.test.js의 중복 import 한 줄을 지운다 — 파일이 SyntaxError로 로드되지 않아 npm test 통과 불가. 단언은 변경 없음

## t-03 verify — 2026-10-04 12:54 (사람 승인)
- [사람] 리뷰 지적 1(사소, quote.js 행 계산 중복)을 반영하지 않는다 — 사람이 반영하지 않음을 선택
- [AI] test/credit-note.test.js의 중복 import 삭제는 약화 아님으로 판정 — 단언 변경 없음, 파일이 로드되지 않던 SyntaxError 해소
