// [단위] 파일 이름. Windows는 파일 이름의 대소문자를 가리지 않는다. 확장자 없는 import('./Markdown')는 확장자를
// 차례로 붙여 찾으므로(.ts가 .tsx보다 먼저), 한 폴더에 확장자를 뺀 이름이 대소문자만 다른 파일이 있으면 다른 파일로
// 풀려 Windows에서만 빌드가 깨진다(PR #10의 app-build #15: Markdown.tsx와 markdown.ts).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../src')

const base = (name: string) => name.replace(/\.[^.]+$/, '')

/** 한 폴더 안에서 확장자를 뺀 이름이 대소문자만 다른 파일 묶음 (src 기준 경로) */
function clashes(dir: string): string[][] {
  const out: string[][] = []
  const byKey = new Map<string, string[]>()
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...clashes(path.join(dir, e.name)))
      continue
    }
    const key = base(e.name).toLowerCase()
    byKey.set(key, [...(byKey.get(key) ?? []), e.name])
  }
  for (const names of byKey.values()) {
    if (new Set(names.map(base)).size > 1) {
      out.push(names.map((n) => path.relative(SRC, path.join(dir, n)).split(path.sep).join('/')))
    }
  }
  return out
}

describe('[단위] 파일 이름', () => {
  it('한 폴더에 확장자를 뺀 이름이 대소문자만 다른 파일이 없다: Windows에서 확장자 없는 import가 다른 파일로 풀린다', () => {
    expect(clashes(SRC)).toEqual([])
  })
})
