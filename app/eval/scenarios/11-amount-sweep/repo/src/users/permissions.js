import { PermissionError } from '../util/errors.js'

// 역할별로 볼 수 있는 리포트
const ROLES = {
  admin: '*',
  accountant: ['profit-loss', 'cashflow', 'balance', 'monthly', 'category', 'vat', 'vendor', 'budget'],
  manager: ['profit-loss', 'monthly', 'category', 'budget'],
  purchaser: ['vendor', 'category'],
  viewer: ['monthly'],
}

export function roles() {
  return Object.keys(ROLES)
}

export function canView(user, report) {
  const allowed = ROLES[user?.role]
  if (!allowed) return false
  return allowed === '*' || allowed.includes(report)
}

export function assertCanView(user, report) {
  if (!canView(user, report)) throw new PermissionError(user?.name ?? '(알 수 없음)', report)
}

export function visibleReports(user, all) {
  return all.filter((name) => canView(user, name))
}

// 사용자 목록 파일. 한 줄에 '이름 역할'. # 뒤는 주석
export function parseUsers(text) {
  const users = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const [name, role] = line.split(/\s+/)
    if (!ROLES[role]) throw new Error(`없는 역할: ${role} (${name})`)
    users.push({ name, role })
  }
  return users
}
