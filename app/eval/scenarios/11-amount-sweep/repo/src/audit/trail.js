// 누가 어떤 리포트를 언제 뽑았는지 남긴다. 메모리에만 두고 CLI가 끝날 때 파일로 쓴다
const entries = []
const MAX = 1000

export function record(user, report, params = {}, now = new Date()) {
  entries.push({ at: now.toISOString(), user, report, params: { ...params } })
  if (entries.length > MAX) entries.splice(0, entries.length - MAX)
}

export function recent(n = 20) {
  return entries.slice(-n).reverse()
}

export function byUser(user) {
  return entries.filter((e) => e.user === user)
}

export function clear() {
  entries.length = 0
}

export function toLines() {
  return entries.map((e) => `${e.at}\t${e.user}\t${e.report}\t${JSON.stringify(e.params)}`)
}

// 리포트별 뽑은 횟수
export function countByReport() {
  const out = {}
  for (const e of entries) out[e.report] = (out[e.report] ?? 0) + 1
  return out
}
