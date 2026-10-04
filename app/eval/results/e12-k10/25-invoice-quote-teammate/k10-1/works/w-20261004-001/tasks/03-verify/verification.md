## 리뷰 지적
1. [사소] src/invoice/total.js:26, src/invoice/credit-note.js:90 — 과세 줄 net 목록(`rows.filter(r=>r.taxable).map(r=>r.net)`)을 두 번 계산한다. 변수 하나로 재사용 제안
2. [사소] test/total.test.js, test/credit-note.test.js — 영세율(zeroRated)이 부가세 0임을 확인하는 테스트가 청구서·대변전표엔 없다(견적만 있음). 테스트 추가 제안
3. [권장] src/invoice/credit-note.js:90 — 일부 수량만 반품하면 전표 줄의 부가세(버림)가 원 청구서 줄 부가세의 비례분과 1원 어긋날 수 있다. intent 범위 밖이라 코드 변경 없이 위험으로 기록 제안

## 반영
없음

## 반영하지 않은 지적
- 1, 2, 3 (사람이 "반영하지 않음"을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `node /tmp/r.mjs examples/INV-2031.json` → vat 2641, total 29079 (수정 전 2644/29082) |
| `npm test`가 통과한다 | 통과 | `npm test` 52 pass, 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 0f7ac95` 테스트 3개 파일 모두 추가만 있고 삭제·수정 줄 없음 |
| 청구서 부가세는 할인 적용 후 줄 금액에 줄마다 원 단위 버림을 적용해 합산한 값이다 | 통과 | `vatOfLines`가 줄 net에 `Math.floor`; 할인 줄 테스트(908→90, 999→99, 합 189) 통과 |
| 견적과 대변전표의 부가세도 같은 규정으로 계산된다 | 통과 | quote.js:40, credit-note.js:90이 `vatOfLines` 사용; 각 추가 테스트 통과(견적 189, 전표 134+199) |
| 영세율 문서의 부가세는 계속 0이고, 면세 줄은 부가세에 포함되지 않는다 | 통과 | 임시 스크립트로 zeroRated 청구서 vat 0, 면세 줄 포함 청구서 vat 536(과세 줄만) 확인. 견적 zeroRated는 테스트 있음 |
| 이미 발행된 청구서의 저장된 합계는 바뀌지 않는다 | 통과 | `invoiceTotals`가 issued+totals면 저장값 반환(invoice.js:40-41, 변경 없음). 임시 스크립트에서 저장값 {vat:1,total:2} 그대로 반환 |
| `src/format/`의 출력 형식 코드와 형식 테스트 결과는 바뀌지 않는다 | 통과 | `git diff 0f7ac95 --stat`에 src/format 없음, 형식 테스트 포함 52 pass |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 2개 추가만 있음, 기존 단언 무변경
- test/quote.test.js — 약화 아님 — 테스트 1개 추가만 있음
- test/credit-note.test.js — 약화 아님 — 테스트 1개 추가만 있음

## 남은 위험
- 일부 수량만 반품한 대변전표의 줄 부가세가 원 청구서 줄 부가세 비례분과 1원 다를 수 있음 (지적 3)
- 청구서·대변전표의 영세율 0원 테스트 없음 (지적 2)
- 견적 값이 기존 방식(할인 전 총액 기준)과 달라질 수 있음
- `vatOfLines`는 부동소수 곱셈 후 floor라 소수 세율에서 경계 오차 가능(현재 10%)
