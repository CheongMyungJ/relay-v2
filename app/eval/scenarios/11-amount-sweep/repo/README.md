# ledger

작은 회사의 원장(CSV)에서 재무 리포트를 뽑는 도구. 외부 의존성 없이 Node만 쓴다.

## 원장

한 줄이 거래 하나다. 머리줄은 한글이나 영문 이름을 쓴다.

| 칸 | 뜻 |
|---|---|
| 일자 (date) | `2026-03-02`, `2026.03.02`, `2026/3/2` |
| 계정 (account) | 네 자리 계정코드. 1 자산, 2 부채, 3 자본, 4 수익, 5 비용 (`src/ledger/accounts.js`) |
| 분류 (category) | 자유롭게 쓰는 분류 |
| 거래처 (vendor) | 거래처 이름 |
| 적요 (memo) | 메모 |
| 금액 (amount) | 사람이 적은 그대로의 금액 글자. `1,200`, `₩3,000`, `12.50` 같은 형식 |
| 부가세 (vat) | 세액. 비어 있으면 공급가액의 10% |

`loadLedger`는 금액을 숫자로 바꾸지 않고 적힌 글자 그대로 둔다. 리포트가 각자 읽는다.
예시는 `samples/ledger-2026q1.csv`.

## 리포트

리포트 함수는 모두 원장 행 배열(`loadLedger`의 결과와 같은 모양)을 받는다.

| 이름 | 모듈 | 함수 |
|---|---|---|
| 손익계산 | `src/reports/profit-loss.js` | `profitAndLoss(rows, period)` |
| 현금흐름 | `src/reports/cashflow.js` | `cashflow(rows, opening)` |
| 계정 잔액 | `src/reports/balance.js` | `accountBalances(rows, asOf)` |
| 월별 합계 | `src/reports/monthly.js` | `monthlyTotals(rows, year)` |
| 분류별 지출 | `src/reports/category.js` | `spendingByCategory(rows, options)` |
| 부가세 | `src/reports/vat.js` | `vatSummary(rows, period)` |
| 거래처별 매입 | `src/reports/vendor.js` | `vendorTotals(rows, limit)` |
| 예산 대비 실적 | `src/reports/budget.js` | `budgetVsActual(rows, plan, period)` |

다른 팀의 스크립트가 이 모듈들을 직접 불러 쓴다.

## 쓰는 법

```
node src/cli.js profit-loss samples/ledger-2026q1.csv --from 2026-01-01 --to 2026-03-31
node src/cli.js cashflow samples/ledger-2026q1.csv --opening ₩10,000,000
node src/cli.js budget samples/ledger-2026q1.csv --plan samples/budget-2026.txt
node src/cli.js check samples/ledger-2026q1.csv
npm test
```
