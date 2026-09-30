import { ConfigError } from './util/errors.js'

// 리포트 설정. 환경 변수로 덮어쓸 수 있다
const DEFAULTS = {
  currency: 'KRW',
  locale: 'ko-KR',
  fiscalYearStartMonth: 1,
  vatRate: 0.1,
  topVendors: 10,
  logLevel: 'info',
  output: 'text',
}

const OUTPUTS = ['text', 'csv', 'json']

function intIn(value, min, max, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ConfigError(`${name}는 ${min}~${max} 사이의 정수여야 함: ${value}`)
  }
  return n
}

export function loadConfig(env = process.env) {
  const cfg = { ...DEFAULTS }
  if (env.LEDGER_FISCAL_START) {
    cfg.fiscalYearStartMonth = intIn(env.LEDGER_FISCAL_START, 1, 12, 'LEDGER_FISCAL_START')
  }
  if (env.LEDGER_TOP_VENDORS) {
    cfg.topVendors = intIn(env.LEDGER_TOP_VENDORS, 1, 100, 'LEDGER_TOP_VENDORS')
  }
  if (env.LEDGER_VAT_RATE) {
    const rate = Number(env.LEDGER_VAT_RATE)
    if (!(rate >= 0 && rate < 1)) throw new ConfigError(`LEDGER_VAT_RATE가 이상함: ${env.LEDGER_VAT_RATE}`)
    cfg.vatRate = rate
  }
  if (env.LEDGER_OUTPUT) {
    if (!OUTPUTS.includes(env.LEDGER_OUTPUT)) {
      throw new ConfigError(`LEDGER_OUTPUT은 ${OUTPUTS.join(', ')} 가운데 하나: ${env.LEDGER_OUTPUT}`)
    }
    cfg.output = env.LEDGER_OUTPUT
  }
  if (env.LEDGER_LOG_LEVEL) cfg.logLevel = env.LEDGER_LOG_LEVEL
  return Object.freeze(cfg)
}

export function describeConfig(cfg) {
  return Object.entries(cfg)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}
