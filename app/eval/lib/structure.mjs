// 장기 평가의 구조 지표(보조, relay-v3 docs/m3-design.md 6절 '구조 지표(최대 파일 줄 수, 중복)'). 레포 폴더 하나의 파일을 읽어
// 센다. git·모델을 부르지 않는다.
// - lines: 시나리오 sequence.lines.include에 맞는 파일(보통 src/**/*.js, test/**/*.js)의 줄 수 합, 파일 수, 가장 긴 파일
// - over: 줄 수가 상한(sequence.bait.maxLines, 기본 600)을 넘는 파일 수와 목록
// - duplication: 코드 파일(DUP_INCLUDE, 기본 src/**/*.js)의 간단한 중복. 줄마다 앞뒤 공백을 지우고 빈 줄, 주석만인 줄, 괄호·
//   쉼표만인 줄을 뺀 '뜻 있는 줄'의 차례에서 WINDOW(6)줄 창을 모두 만들고, 같은 창이 두 곳 이상(다른 파일이거나 같은 파일의
//   다른 자리)에 있으면 그 창의 줄을 중복으로 센다. lines는 중복에 든 뜻 있는 줄 수(자리마다 한 번), ratio는 그것을 뜻 있는
//   줄 수로 나눈 것, groups는 두 곳 이상에 있는 서로 다른 창의 수다. 이름만 바꾼 복사(type-2)는 잡지 못한다(간단한 지표)
// - definitions: 같은 코드 파일들에서 맨 바깥(줄 처음)에 정의한 함수 이름(function 이름, const 이름 = (…) =>) 가운데 두 파일
//   이상에 있는 것의 수와 목록. 같은 일을 하는 도우미를 파일마다 따로 둔 중복(48의 금액 표시처럼 글은 달라도 이름이 같은 것)을
//   잡는다. 이름이 다른 중복은 잡지 못한다
import fs from 'node:fs'
import path from 'node:path'
import { matchesAny } from './repo.mjs'

export const WINDOW = 6
export const DUP_INCLUDE = ['src/**/*.js']

/** 폴더 아래 파일의 상대 경로(.git, node_modules 빼고), 정렬 */
export function listFiles(root) {
  const out = []
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const file = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.git') walk(file)
      } else if (e.isFile()) out.push(file)
    }
  }
  if (fs.existsSync(root)) walk('')
  return out.sort()
}

/** 글의 줄 수(끝 줄바꿈은 줄로 세지 않는다. check-scenario.mjs countLines와 같다) */
export const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

/** 뜻 있는 줄인가: 빈 줄, 주석만인 줄(//, /*, *, *\/), 괄호·쉼표·세미콜론만인 줄이 아니다 */
export function meaningful(line) {
  const t = line.trim()
  if (!t) return false
  if (/^(\/\/|\/\*|\*\/?|\*)/.test(t)) return false
  return !/^[\s{}()[\];,]*$/.test(t)
}

/**
 * 파일들의 중복(머리 주석). files는 { file, text }다
 * @returns {{ window: number, lines: number, total: number, ratio: number | null, groups: number }}
 */
export function duplication(files, window = WINDOW) {
  const seqs = files.map(({ file, text }) => ({
    file,
    lines: text
      .split('\n')
      .map((l) => l.trim())
      .filter(meaningful),
  }))
  const total = seqs.reduce((a, s) => a + s.lines.length, 0)
  const at = new Map()
  for (const [k, s] of seqs.entries())
    for (let i = 0; i + window <= s.lines.length; i++) {
      const key = s.lines.slice(i, i + window).join('\n')
      if (!at.has(key)) at.set(key, [])
      at.get(key).push([k, i])
    }
  const dup = new Set()
  let groups = 0
  for (const spots of at.values()) {
    if (spots.length < 2) continue
    groups++
    for (const [k, i] of spots) for (let j = i; j < i + window; j++) dup.add(`${k}:${j}`)
  }
  return { window, lines: dup.size, total, ratio: total ? dup.size / total : null, groups }
}

const DEF = [
  /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
]

/** 파일들의 맨 바깥 함수 정의 가운데 두 파일 이상에 있는 이름(머리 주석) */
export function duplicateDefinitions(files) {
  const where = new Map()
  for (const { file, text } of files)
    for (const line of text.split('\n')) {
      const name = DEF.map((re) => re.exec(line)?.[1]).find(Boolean)
      if (!name) continue
      if (!where.has(name)) where.set(name, new Set())
      where.get(name).add(file)
    }
  const names = [...where]
    .filter(([, f]) => f.size > 1)
    .map(([name, f]) => ({ name, files: [...f].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { count: names.length, names }
}

/**
 * 레포 폴더 하나의 구조 지표
 * @param {string} root 레포 폴더(.git이 있어도 된다)
 * @param {{ include?: string[], maxLines?: number, dupInclude?: string[] }} [o] include는 sequence.lines.include
 */
export function structureMetrics(root, o = {}) {
  const include = o.include ?? ['src/**/*.js', 'test/**/*.js']
  const maxLines = o.maxLines ?? 600
  const all = listFiles(root)
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
  const counted = all
    .filter((f) => matchesAny(f, include))
    .map((file) => ({ file, text: read(file) }))
  const sized = counted.map(({ file, text }) => ({ file, lines: lineCount(text) }))
  const longest = sized.reduce((m, x) => (x.lines > m.lines ? x : m), { file: null, lines: 0 })
  const over = sized.filter((x) => x.lines > maxLines).map((x) => x.file)
  const code = all
    .filter((f) => matchesAny(f, o.dupInclude ?? DUP_INCLUDE))
    .map((file) => ({ file, text: read(file) }))
  return {
    files: sized.length,
    lines: sized.reduce((a, x) => a + x.lines, 0),
    longest,
    maxLines,
    over: { count: over.length, files: over },
    duplication: duplication(code),
    definitions: duplicateDefinitions(code),
  }
}
