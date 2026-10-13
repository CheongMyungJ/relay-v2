// 숨긴 시험의 도움: docs/knowledge/의 지식 파일과 코드의 이름을 읽는다
import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.join(import.meta.dirname, '..')
const KNOWLEDGE = path.join(ROOT, 'docs', 'knowledge')

function walk(dir, ok) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, ok)
    return ok(p) ? [p] : []
  })
}

/** 머리글(key: value 줄)과 본문으로 가른다. 머리글이 없으면 null */
export function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (kv) data[kv[1]] = kv[2].trim()
  }
  return { data, body: m[2] }
}

/** `## <name>` 절의 글. 없으면 null */
export function section(body, name) {
  const parts = body.split(/^## /m).slice(1)
  for (const p of parts) {
    const [head, ...rest] = p.split(/\r?\n/)
    if (head.trim() === name) return rest.join('\n')
  }
  return null
}

/** 바뀐 이력 절을 뺀 본문 */
export function withoutHistory(body) {
  return body.split(/^## /m).filter((p, i) => i === 0 || !/^바뀐 이력/.test(p)).join('## ')
}

/** 지식 파일 모두 */
export function entries() {
  return walk(KNOWLEDGE, (p) => p.endsWith('.md')).map((file) => {
    const text = fs.readFileSync(file, 'utf8')
    const fm = parse(text)
    return {
      file,
      rel: path.relative(ROOT, file).split(path.sep).join('/'),
      text,
      data: fm?.data ?? {},
      body: fm?.body ?? text,
      live: withoutHistory(fm?.body ?? text),
      title: (/^# (.+)$/m.exec(fm?.body ?? text) ?? [])[1] ?? '',
    }
  })
}

/** src/와 test/ 코드 전체 글 */
export function codeText() {
  return ['src', 'test']
    .flatMap((d) => walk(path.join(ROOT, d), (p) => /\.(js|mjs|cjs|ts)$/.test(p)))
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n')
}

/** 이름이 코드에 낱말로 있는가 */
export function inCode(name, code = codeText()) {
  return new RegExp(`(^|[^\\w$])${name.replace(/[$]/g, '\\$')}($|[^\\w$])`).test(code)
}

export const withAnchor = (name) => entries().filter((e) => e.data.anchor === name)
