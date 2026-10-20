// 터미널 글에서 열 수 있는 주소와 경로 찾기(D411), 붙여넣을 파일 경로의 모양(D410). DOM을 쓰지 않아 [단위]로 지킨다.

/** 한 줄 글 안의 범위. end는 포함하지 않는다 */
export interface LinkMatch {
  start: number
  end: number
  text: string
}

export interface LinkCandidates {
  /** http(s) 주소 */
  urls: LinkMatch[]
  /** 경로처럼 보이는 낱말마다 시도할 글. 앞의 것을 먼저 본다. 있는 파일인지는 main이 본다 */
  paths: LinkMatch[][]
}

/** 주소에 들지 않는 글자. 한글 음절은 "…주소에서"처럼 바로 붙는 조사를 떼려고 넣는다 */
const URL_RE = /https?:\/\/[^\s"'`<>\uac00-\ud7a3]+/g
/** 경로 낱말을 가르는 글자 */
const TOKEN_RE = /[^\s"'`<>()[\]{},;|│]+/g
const HANGUL_TAIL = /[\uac00-\ud7a3]+$/
/** 낱말 끝의 줄·칸 번호: a.ts:12, a.ts:12:5, a.ts#L12, a.ts#L12-L20 */
const LINE_TAIL = /(?::\d+){1,2}$|#L\d+(?:-L?\d+)?$/
const TRAILING_PUNCT = /[.:!?]+$/
const EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,9}$/
/** 한 줄에서 볼 경로 낱말 수. 넘으면 앞의 것만 본다 */
const MAX_PATH_TOKENS = 30

function trimUrl(url: string): string {
  let s = url
  for (;;) {
    const last = s.slice(-1)
    if (!last || !/[.,:;!?'")\]}>]/.test(last)) return s
    // 위키 주소처럼 괄호가 짝을 이루면 닫는 괄호를 남긴다
    if (last === ')' && (s.match(/\(/g)?.length ?? 0) >= (s.match(/\)/g)?.length ?? 0)) return s
    s = s.slice(0, -1)
  }
}

/** 낱말 끝의 문장 부호와 줄 번호를 뗀다 */
function trimPath(s: string): string {
  let t = s.replace(TRAILING_PUNCT, '')
  t = t.replace(LINE_TAIL, '')
  return t.replace(TRAILING_PUNCT, '')
}

function pathLike(s: string): boolean {
  if (s.length < 2 || s.includes('://')) return s.toLowerCase().startsWith('file://')
  if (/^[\\/.~]+$/.test(s)) return false
  if (/[\\/]/.test(s)) return true
  return EXTENSION.test(s)
}

/** 한 줄 글에서 열 수 있어 보이는 것을 찾는다 */
export function findLinks(line: string): LinkCandidates {
  const urls: LinkMatch[] = []
  for (const m of line.matchAll(URL_RE)) {
    const text = trimUrl(m[0])
    if (text.length > 'https://'.length)
      urls.push({ start: m.index, end: m.index + text.length, text })
  }
  const inUrl = (i: number) => urls.some((u) => i >= u.start && i < u.end)

  const paths: LinkMatch[][] = []
  for (const m of line.matchAll(TOKEN_RE)) {
    if (paths.length >= MAX_PATH_TOKENS) break
    if (inUrl(m.index)) continue
    let token = m[0]
    let start = m.index
    // Claude Code의 파일 언급(@경로)
    if (token.startsWith('@')) {
      token = token.slice(1)
      start += 1
    }
    const tries: LinkMatch[] = []
    const add = (text: string) => {
      if (pathLike(text) && !tries.some((t) => t.text === text)) {
        tries.push({ start, end: start + text.length, text })
      }
    }
    add(trimPath(token))
    // "src/a.ts를"처럼 붙은 조사를 뗀 것도 본다. 한글 이름의 파일이 있으면 그것이 먼저다
    const hangul = HANGUL_TAIL.exec(token)
    if (hangul && hangul.index > 0) add(trimPath(token.slice(0, hangul.index)))
    if (tries.length) paths.push(tries)
  }
  return { urls, paths }
}

/**
 * 붙여넣을 파일 경로의 글. 엔진은 붙여넣은 글 전체가 그림 경로이면 그림으로 첨부한다(Claude Code는 따옴표로 감싼
 * 경로도 받는다). Claude Code는 붙여넣은 경로의 `\`를 이스케이프로 읽으므로 Windows 경로는 `/`로 바꾼다
 */
export function pasteText(file: string, platform: string): string {
  if (platform === 'win32') {
    const p = file.replace(/\\/g, '/')
    return /\s/.test(p) ? `"${p}"` : p
  }
  if (!/[\s"'\\]/.test(file)) return file
  if (!/["\\]/.test(file)) return `"${file}"`
  return file.replace(/[\s"'\\]/g, (c) => `\\${c}`)
}
