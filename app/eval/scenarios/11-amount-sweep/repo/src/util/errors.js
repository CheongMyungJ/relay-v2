// 도메인 오류. code로 구분해서 CLI의 종료 코드를 정한다
export class LedgerError extends Error {
  constructor(message, code = 'LEDGER') {
    super(message)
    this.name = 'LedgerError'
    this.code = code
  }
}

export class ParseError extends LedgerError {
  constructor(message, line) {
    super(line ? `${line}번째 줄: ${message}` : message, 'PARSE')
    this.name = 'ParseError'
    this.line = line ?? null
  }
}

export class ConfigError extends LedgerError {
  constructor(message) {
    super(message, 'CONFIG')
    this.name = 'ConfigError'
  }
}

export class PermissionError extends LedgerError {
  constructor(user, report) {
    super(`${user}은(는) ${report} 리포트를 볼 수 없음`, 'PERMISSION')
    this.name = 'PermissionError'
    this.user = user
    this.report = report
  }
}

export function exitCodeFor(err) {
  switch (err && err.code) {
    case 'PARSE':
      return 2
    case 'CONFIG':
      return 3
    case 'PERMISSION':
      return 4
    default:
      return 1
  }
}
