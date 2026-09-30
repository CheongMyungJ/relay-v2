import fs from 'node:fs'
import { assertCanView } from './users/permissions.js'
import { record } from './audit/trail.js'
import { loadConfig } from './config.js'
import { log, setLevel } from './log.js'
import { loadLedgerFile, summarizeLedger } from './ledger/load.js'
import { parsePlan } from './budget/plan.js'
import { getReport, reportNames } from './reports/index.js'
import { toCsv } from './format/csv-out.js'
import { toJson } from './format/json-out.js'
import { exitCodeFor } from './util/errors.js'
import { findDuplicates } from './ledger/duplicates.js'
import { isKnownAccount } from './ledger/accounts.js'

const USAGE = `쓰는 법: node src/cli.js <리포트> <원장.csv> [옵션]
리포트: ${reportNames().join(', ')}
       check (원장 점검)
옵션:
  --from 2026-01-01 --to 2026-03-31   기간
  --year 2026 --quarter 1             연도, 분기 (monthly, vat)
  --as-of 2026-03-31                  기준일 (balance)
  --opening ₩1,000,000                기초 잔액 (cashflow)
  --plan budget.txt                   예산 계획 파일 (budget)
  --top 10                            위에서 몇 개 (category, vendor)
  --output text|csv|json              출력 형식
  --user 이름:역할                    권한 확인과 기록에 쓴다`

export function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      opts._.push(arg)
      continue
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) {
      opts[key] = true
    } else {
      opts[key] = value
      i++
    }
  }
  for (const key of ['year', 'quarter', 'top']) if (opts[key] !== undefined) opts[key] = Number(opts[key])
  return opts
}

function parseUser(text) {
  const [name, role] = String(text || 'local:admin').split(':')
  return { name, role: role || 'viewer' }
}

export function main(argv, { stdout = process.stdout, env = process.env } = {}) {
  const opts = parseArgs(argv)
  const [name, file] = opts._
  if (!name || !file || opts.help) {
    stdout.write(USAGE + '\n')
    return name || opts.help ? 0 : 1
  }
  if (name === 'check') return checkLedger(file, stdout)
  try {
    const cfg = loadConfig(env)
    setLevel(cfg.logLevel)
    const user = parseUser(opts.user)
    assertCanView(user, name)
    const report = getReport(name)
    const rows = loadLedgerFile(file, { strict: !opts.lenient })
    if (opts.plan) opts.plan = parsePlan(fs.readFileSync(opts.plan, 'utf8'))
    if (opts.top === undefined && (name === 'vendor' || name === 'category')) opts.top = cfg.topVendors
    const result = report.run(rows, opts)
    record(user.name, name, { file, from: opts.from, to: opts.to })
    const output = opts.output ?? cfg.output
    if (output === 'json') stdout.write(toJson(result))
    else if (output === 'csv') stdout.write(toCsv(report.table(result)))
    else stdout.write(report.render(result, opts))
    return 0
  } catch (err) {
    log.error(err.message)
    return exitCodeFor(err)
  }
}

// 원장 점검: 개요, 미등록 계정, 중복 의심 행
function checkLedger(file, stdout) {
  try {
    const rows = loadLedgerFile(file, { strict: false })
    const info = summarizeLedger(rows)
    const unknown = [...new Set(rows.map((r) => r.account).filter((a) => !isKnownAccount(a)))]
    const dups = findDuplicates(rows)
    stdout.write(`행 ${info.rows}개, 기간 ${info.from} ~ ${info.to}\n`)
    stdout.write(`거래처 없는 행 ${info.noVendor}개\n`)
    if (unknown.length) stdout.write(`미등록 계정: ${unknown.join(', ')}\n`)
    for (const g of dups) stdout.write(`중복 의심: ${g.indexes.map((i) => i + 2).join(', ')}번째 줄\n`)
    return unknown.length || dups.length ? 5 : 0
  } catch (err) {
    log.error(err.message)
    return exitCodeFor(err)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2))
}
