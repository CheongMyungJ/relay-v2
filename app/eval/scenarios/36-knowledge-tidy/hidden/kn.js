import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'docs', 'knowledge')

// 지식 파일 전부: { path, text, anchor, body(바뀐 이력 절을 뺀 본문) }
export function entries() {
  const out = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf8')
        const m = /^---\n([\s\S]*?)\n---/.exec(text)
        const anchor = m ? (/^anchor:\s*(\S+)/m.exec(m[1])?.[1] ?? null) : null
        // 바뀐 이력은 지난 사실이라 판정에서 뺀다 (지식 형식에서 마지막 절)
        const body = text.split(/^## 바뀐 이력/m)[0]
        out.push({ path: path.relative(process.cwd(), p), text, anchor, body })
      }
    }
  }
  walk(ROOT)
  return out
}
