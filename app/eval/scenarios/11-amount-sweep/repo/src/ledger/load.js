import fs from 'node:fs'
import { log } from '../log.js'
import { detectSeparator, parseCsvLine, splitLines } from './csv.js'
import { mapHeader, toRow, validateRow } from './schema.js'
import { toIso } from '../lib/dates.js'

// 원장 CSV를 행 배열로 읽는다. 금액과 부가세는 원장에 적힌 문자열 그대로 둔다
export function loadLedger(text, { strict = true } = {}) {
  const lines = splitLines(text)
  if (!lines.length) return []
  const sep = detectSeparator(lines[0])
  const index = mapHeader(parseCsvLine(lines[0], sep))
  const rows = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const row = toRow(parseCsvLine(line, sep), index)
    try {
      rows.push(validateRow(row, i + 1))
    } catch (err) {
      if (strict) throw err
      skipped++
      log.warn('원장 행 건너뜀', { line: i + 1, reason: err.message })
    }
  }
  if (skipped) log.info('원장 읽기 끝', { rows: rows.length, skipped })
  return rows
}

export function loadLedgerFile(file, options) {
  return loadLedger(fs.readFileSync(file, 'utf8'), options)
}

// 원장 개요: 행 수, 기간, 계정별 행 수, 거래처가 빈 행 수
export function summarizeLedger(rows) {
  const dates = rows.map((r) => toIso(r.date)).filter(Boolean).sort()
  const perAccount = {}
  let noVendor = 0
  for (const row of rows) {
    perAccount[row.account] = (perAccount[row.account] ?? 0) + 1
    if (!row.vendor) noVendor++
  }
  return {
    rows: rows.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    perAccount,
    noVendor,
  }
}
