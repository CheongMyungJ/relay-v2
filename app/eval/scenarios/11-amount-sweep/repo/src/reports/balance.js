import { accountName, accountType } from '../ledger/accounts.js'
import { toIso } from '../lib/dates.js'
import { parseAmount } from '../lib/money.js'
import { renderTable } from '../lib/table.js'
import { formatWon } from '../format/number.js'
import { renderReport } from '../format/text.js'

// asOf(포함)까지의 계정별 잔액. asOf가 없으면 전체
export function accountBalances(rows, asOf) {
  const limit = asOf ? toIso(asOf) : null
  const balances = {}
  for (const row of rows) {
    if (limit && toIso(row.date) > limit) continue
    balances[row.account] = (balances[row.account] ?? 0) + parseAmount(row.amount)
  }
  return balances
}

export function balanceOf(rows, account, asOf) {
  return accountBalances(rows, asOf)[String(account)] ?? 0
}

// 종류별(자산, 부채, ...) 합계
export function balancesByType(balances) {
  const out = {}
  for (const [account, value] of Object.entries(balances)) {
    const type = accountType(account)
    out[type] = (out[type] ?? 0) + value
  }
  return out
}

// 잔액이 0이 아닌 계정만
export function nonZeroBalances(balances) {
  const out = {}
  for (const [account, value] of Object.entries(balances)) {
    if (Math.abs(value) > 1e-9) out[account] = value
  }
  return out
}

export function formatBalances(balances, asOf) {
  const rows = Object.keys(balances)
    .sort()
    .map((account) => ({ account, name: accountName(account), balance: balances[account] }))
  const table = renderTable(
    [
      { key: 'account', title: '계정' },
      { key: 'name', title: '이름', max: 16 },
      { key: 'balance', title: '잔액', align: 'right', format: (v) => formatWon(v, { sign: 'paren' }) },
    ],
    rows,
  )
  return renderReport(asOf ? `계정 잔액 (${asOf} 기준)` : '계정 잔액', [{ body: table }])
}
