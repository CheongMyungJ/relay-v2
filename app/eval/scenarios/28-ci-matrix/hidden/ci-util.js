// 숨긴 시험의 도움 함수: CI 워크플로에서 Node 버전과 단계를 읽는다 (YAML 파서 없이)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// .pathname은 퍼센트 인코딩된 글이고 Windows에서는 /C:/… 꼴이라 경로로 쓰지 않는다 (PR #29 리뷰)
const root = fileURLToPath(new URL('..', import.meta.url))

export function workflows() {
  const dir = path.join(root, '.github', 'workflows')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
}

/**
 * `node-version: 18`, `node-version: [18, 20]`, `node: [...]`, 줄마다 `- 18`인 목록, `matrix.include`의
 * `- node-version: 18` 항목에서 주 버전을 모은다
 */
export function nodeVersions(text) {
  const out = new Set()
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const m = /^(\s*)(?:-\s*)?(?:node-version|node|node_version|version)s?\s*:\s*(.*)$/.exec(line)
    if (!m || /matrix\./.test(m[2])) return
    let value = m[2].trim()
    if (!value) {
      const items = []
      for (let j = i + 1; j < lines.length; j++) {
        const item = /^\s*-\s*(.+)$/.exec(lines[j])
        if (!item) break
        items.push(item[1])
      }
      value = items.join(',')
    }
    for (const v of value.matchAll(/\b(\d{2})(?:\.[\dx]+)*\b/g)) out.add(Number(v[1]))
  })
  return [...out].sort((a, b) => a - b)
}

/** 모든 워크플로에서 모은 Node 주 버전. lint와 테스트를 다른 워크플로에 나눠 둬도 된다 (PR #29 리뷰) */
export function allNodeVersions() {
  return [...new Set(workflows().flatMap(nodeVersions))].sort((a, b) => a - b)
}

export function pkg() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
}

export { root }
