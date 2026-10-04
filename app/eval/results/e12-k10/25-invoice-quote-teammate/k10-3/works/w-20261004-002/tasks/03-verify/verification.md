## 리뷰 지적
1. [권장] test/credit-note.test.js — 면세 줄이 섞인 반품 전표와 영세율 반품 전표의 부가세 테스트가 없어 `lineVat`의 면세 0, `zeroRated` 0 경로가 검증되지 않음. 테스트 추가를 제안.
2. [사소] test/credit-note.test.js:85 — 테스트 안에서 `readFile`을 동적 import함. 파일 맨 위 import로 옮기면 읽기 쉬움.
3. [사소] test/credit-note.test.js:93 — "저장된 totals가 있으면 다시 계산하지 않는다" 테스트는 수정과 무관하게 처음부터 통과하는 기존 동작 고정 테스트임(변경 필요 없음, 참고).

원인과 수정은 일치한다(합계 반올림 → 줄별 버림). 비목표(저장된 totals, `src/format/`)는 건드리지 않았다. 차단 지적은 없다.

## 반영
- 1 — 면세 줄 섞임(OF-1990×3, BK-1800×1: vat 567, total 24,237)과 영세율(vat 0, total 23,670) 테스트를 추가. 커밋 5a8f14a. `npm test` → 51개 통과, 0 실패. 재현 절차는 바뀌지 않았다.
- 팀 지식 `docs/knowledge/invoice/vat-rule.md`를 같은 경로에 새 형식으로 써서 커밋(앞 Work의 내용을 모두 살림). 코드 변경 없음.

## 반영하지 않은 지적
- 2 (사람이 차단·권장만 반영을 골라 제외)
- 3 (변경이 필요 없는 참고)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(examples/CN-0112.json을 examples/INV-2047.json에 적용한 반품 전표 계산)가 더 이상 실패하지 않는다 | 통과 | `createCreditNote(INV-2047, CN-0112).totals`를 직접 실행: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1742, total: 19180 }` (fix.md의 수정 전 값은 vat 1744, total 19182) |
| `npm test`가 통과한다 | 통과 | `npm test` → pass 51, fail 0 (최종 코드) |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 테스트 변경은 `test/credit-note.test.js`의 추가뿐, 기존 테스트 줄 삭제·수정 없음 |
| CN-0112 반품 전표의 환불 합계(`totals.total`)가 19,180원이다 | 통과 | 위 재현 실행과 재현 테스트의 `total: 19180` |
| 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 다시 계산하지 않고 저장된 값을 그대로 돌려준다 | 통과 | `creditNoteTotals`는 `note.totals ?? creditTotals(note)`로 변경 없음. 테스트가 `strictEqual`로 같은 객체 반환을 확인(통과) |
| `src/format/`의 파일과 출력 결과가 바뀌지 않는다 | 통과 | `git diff 403bb0f --stat -- src/format` 출력 없음. 변경 파일은 docs, credit-note.js, total.js, 테스트뿐 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 테스트 3개를 추가했을 뿐(재현 테스트, 저장값 고정, 면세·영세율). 기존 테스트와 단언은 그대로.

## 남은 위험
- 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `lineVat`과 `creditTotals` 변경이 겹쳐 머지 때 충돌할 수 있다.
- `computeTotals`(합계 반올림)와 `quoteTotals`(할인 전·할인 합 각각 반올림)는 아직 줄별 버림이 아니다. 요청 범위 밖.
- 반품 전표와 옛 규칙으로 저장된 청구서 사이 부가세 차이(CN-0112 2원, INV-2047 전부 반품 3원)는 보정하지 않았다(사람이 결정).
